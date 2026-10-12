import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

async function setup(overrides = {}) {
  const calls = [];
  const native = {
    session: async () => ({ authenticated: true }),
    login: async () => ({ authenticated: true }),
    logout: async () => ({ authenticated: false }),
    request: async options => {
      calls.push(options);
      return { status: 200, contentType: 'application/json', body: Buffer.from('{"ok":true}').toString('base64') };
    },
    cancel: async options => { calls.push({ cancel: options.id }); },
    ...overrides,
  };
  const context = vm.createContext({ EventTarget, Event, Headers, Response, Uint8Array, atob, crypto, console });
  const dependency = new vm.SyntheticModule(['Capacitor', 'registerPlugin'], function () {
    this.setExport('Capacitor', { getPlatform: () => 'ios', isPluginAvailable: () => true });
    this.setExport('registerPlugin', () => native);
  }, { context });
  const source = stripTypeScriptTypes(readFileSync(new URL('../src/native-client.ts', import.meta.url), 'utf8'));
  const module = new vm.SourceTextModule(source, { context });
  await module.link(specifier => { assert.equal(specifier, '@capacitor/core'); return dependency; });
  await module.evaluate();
  return { client: module.namespace, calls };
}

test('contacts and binary photos are adapted to Response; no auth headers cross the bridge', async () => {
  const { client, calls } = await setup();
  await client.checkSession();
  assert.deepEqual(await (await client.apiFetch('/api/v1/people')).json(), { ok: true });
  await client.apiFetch('/api/v1/people/00000000-0000-4000-8000-000000000001', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{"firstName":"Example"}',
  });
  assert.equal(calls[1].body, '{"firstName":"Example"}');
  assert.deepEqual(Object.keys(calls[1]).sort(), ['body', 'id', 'method', 'path']);
  const binary = await setup({ request: async () => ({ status: 200, contentType: 'image/png', body: 'AAH/' }) });
  await binary.client.checkSession();
  const image = await binary.client.apiFetch('/api/v1/people/00000000-0000-4000-8000-000000000001/photo');
  assert.deepEqual([...new Uint8Array(await image.arrayBuffer())], [0, 1, 255]);
});

test('external URLs, traversal, query strings, credentials, deletes and uploads fail before bridge request', async () => {
  const { client, calls } = await setup();
  await client.checkSession();
  for (const path of ['https://evil.invalid/api/v1/people', '//evil.invalid/api/v1/people', '/api/v1/../auth', '/api/v1/%2e%2e/auth', '/api/v1/people?url=evil']) {
    await assert.rejects(client.apiFetch(path));
  }
  await assert.rejects(client.apiFetch('/api/v1/people', { headers: { Cookie: 'secret' } }));
  await assert.rejects(client.apiFetch('/api/v1/people', { headers: { Authorization: 'secret' } }));
  await assert.rejects(client.apiFetch('/api/v1/people', { method: 'DELETE' }));
  await assert.rejects(client.apiFetch('/api/v1/people', { method: 'POST', body: new FormData() }));
  assert.equal(calls.length, 0);
});

test('session checks coalesce, expired sessions clear consumers, and reads require authentication', async () => {
  let resolve;
  let checks = 0;
  const { client } = await setup({ session: () => { checks++; return new Promise(r => { resolve = r; }); } });
  await assert.rejects(client.apiFetch('/api/v1/people'), /Authentication required/);
  const first = client.checkSession(), second = client.checkSession();
  assert.equal(checks, 1);
  resolve({ authenticated: true });
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  const expired = await setup({ request: async () => { throw Object.assign(new Error('Expired'), { code: 'SESSION_EXPIRED' }); } });
  let count = 0;
  expired.client.onSessionExpired(() => count++);
  await expired.client.checkSession();
  await assert.rejects(expired.client.apiFetch('/api/v1/people'));
  assert.equal(count, 1);
  await assert.rejects(expired.client.apiFetch('/api/v1/people'), /Authentication required/);
});

test('abort cancels native request and prevents late response delivery', async () => {
  let complete;
  const { client, calls } = await setup({ request: () => new Promise(resolve => { complete = resolve; }) });
  await client.checkSession();
  const abort = new AbortController();
  const pending = client.apiFetch('/api/v1/people', { signal: abort.signal });
  abort.abort();
  assert.equal(calls.length, 1);
  assert.ok(calls[0].cancel);
  complete({ status: 200, contentType: 'application/json', body: 'e30=' });
  await assert.rejects(pending, { name: 'AbortError' });
});

test('logout invalidates in-flight data; failed logout retains a retryable session', async () => {
  let complete;
  const { client } = await setup({ request: () => new Promise(resolve => { complete = resolve; }) });
  await client.checkSession();
  const pending = client.apiFetch('/api/v1/people');
  await client.signOut();
  complete({ status: 200, contentType: 'application/json', body: 'e30=' });
  await assert.rejects(pending, /Session changed/);
  const failed = await setup({ logout: async () => { throw new Error('Offline'); } });
  await failed.client.checkSession();
  await assert.rejects(failed.client.signOut(), /Offline/);
  assert.equal((await failed.client.apiFetch('/api/v1/people')).status, 200);
});
