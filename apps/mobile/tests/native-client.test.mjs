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
  const context = vm.createContext({ EventTarget, Event, Headers, Response, Uint8Array, atob, btoa, Blob, FormData, crypto, console });
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

test('external URLs, traversal, query strings, credentials, contact deletes and uploads fail before bridge request', async () => {
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


test('relationship create/edit/delete use exact routes; deletion permits an empty response', async () => {
  const calls = [];
  const { client } = await setup({ request: async options => {
    calls.push(options);
    return { status: options.method === 'DELETE' ? 204 : 200,
      contentType: 'application/json', body: options.method === 'DELETE' ? '' : 'e30=' };
  } });
  await client.checkSession();
  const path = '/api/v1/relationships/00000000-0000-4000-8000-000000000001';
  const payload = JSON.stringify({ fromId: '00000000-0000-4000-8000-000000000002',
    toId: '00000000-0000-4000-8000-000000000003', strength: 3 });
  await client.apiFetch('/api/v1/relationships', { method: 'POST', body: payload });
  await client.apiFetch(path, { method: 'PATCH', body: '{"strength":4}' });
  const removed = await client.apiFetch(path, { method: 'DELETE' });
  assert.equal(removed.status, 204);
  assert.equal(await removed.text(), '');
  assert.deepEqual(calls.map(c => c.method), ['POST', 'PATCH', 'DELETE']);
  assert.equal(calls[0].body, payload);
  assert.equal(calls[1].body, '{"strength":4}');
  assert.equal(Object.hasOwn(calls[2], 'body'), false);
});

test('relationship access does not enable other mutations or replay expired writes', async () => {
  const { client, calls } = await setup();
  await client.checkSession();
  const id = '00000000-0000-4000-8000-000000000001';
  for (const [path, method] of [
    ['/api/v1/relationships', 'DELETE'], ['/api/v1/relationships', 'PATCH'],
    ['/api/v1/relationships/not-a-uuid', 'DELETE'],
    [`/api/v1/relationships/${id}/`, 'DELETE'], [`/api/v1/relationships/${id}/photo`, 'POST'],
    [`/api/v1/people/${id}`, 'DELETE'], ['/api/v1/graph-styles', 'POST'],
    ['/api/v1/auth/mobile/revoke', 'POST'], ['/api/v1/messages', 'POST'],
    [`/api/v1/relationships/${id}`, 'PUT'],
  ]) await assert.rejects(client.apiFetch(path, { method }));
  await assert.rejects(client.apiFetch(`/api/v1/relationships/${id}`, { method: 'DELETE', body: '{}' }));
  assert.equal(calls.length, 0);
  let writes = 0;
  const expired = await setup({ request: async () => {
    writes++;
    throw Object.assign(new Error('Expired'), { code: 'SESSION_EXPIRED' });
  } });
  await expired.client.checkSession();
  await assert.rejects(expired.client.apiFetch('/api/v1/relationships', { method: 'POST', body: '{}' }));
  assert.equal(writes, 1);
  await assert.rejects(expired.client.apiFetch('/api/v1/relationships', { method: 'POST', body: '{}' }), /Authentication required/);
  assert.equal(writes, 1);
});


test('categories and interests support CRUD and bodyless contact assignment/removal', async () => {
  const { client, calls } = await setup();
  await client.checkSession();
  const person = '00000000-0000-4000-8000-000000000001';
  const item = '00000000-0000-4000-8000-000000000002';
  for (const kind of ['categories', 'interests']) {
    const collection = `/api/v1/${kind}`;
    const assignment = `/api/v1/people/${person}/${kind}/${item}`;
    await client.apiFetch(collection, { method: 'POST', body: '{"name":"Test"}' });
    await client.apiFetch(`${collection}/${item}`, { method: 'PATCH', body: '{"name":"Renamed"}' });
    await client.apiFetch(assignment, { method: 'POST' });
    await client.apiFetch(assignment, { method: 'DELETE' });
    await client.apiFetch(`${collection}/${item}`, { method: 'DELETE' });
  }
  assert.deepEqual(calls.map(c => c.method), ['POST', 'PATCH', 'POST', 'DELETE', 'DELETE', 'POST', 'PATCH', 'POST', 'DELETE', 'DELETE']);
  assert.equal(calls[0].body, '{"name":"Test"}');
  assert.equal(calls[1].body, '{"name":"Renamed"}');
  for (const index of [2, 3, 4, 7, 8, 9]) assert.equal(Object.hasOwn(calls[index], 'body'), false);
});

test('taxonomy routes reject malformed IDs, bulk deletes and unsupported assignment operations', async () => {
  const { client, calls } = await setup();
  await client.checkSession();
  const id = '00000000-0000-4000-8000-000000000001';
  for (const kind of ['categories', 'interests']) {
    for (const [path, method] of [
      [`/api/v1/${kind}`, 'DELETE'], [`/api/v1/${kind}`, 'PATCH'],
      [`/api/v1/${kind}/invalid`, 'PATCH'], [`/api/v1/${kind}/${id}/`, 'DELETE'],
      [`/api/v1/people/${id}/${kind}`, 'POST'],
      [`/api/v1/people/invalid/${kind}/${id}`, 'POST'],
      [`/api/v1/people/${id}/${kind}/invalid`, 'DELETE'],
      [`/api/v1/people/${id}/${kind}/${id}`, 'PATCH'],
      [`/api/v1/people/${id}/${kind}/${id}/extra`, 'POST'],
    ]) await assert.rejects(client.apiFetch(path, { method }));
    await assert.rejects(client.apiFetch(`/api/v1/people/${id}/${kind}/${id}`, { method: 'POST', body: '{}' }));
  }
  await assert.rejects(client.apiFetch(`/api/v1/people/${id}/photo`, { method: 'PATCH', body: '{}' }));
  assert.equal(calls.length, 0);
});


test('event creation and event/reminder editing and removal use existing API routes', async () => {
  const { client, calls } = await setup();
  await client.checkSession();
  const id = '00000000-0000-4000-8000-000000000001';
  const body = JSON.stringify({ type: 'meeting', title: 'Test', dueAt: '2030-01-01T12:00:00.000Z' });
  await client.apiFetch(`/api/v1/people/${id}/contact-events`, { method: 'POST', body });
  for (const kind of ['contact-events', 'reminders']) {
    await client.apiFetch(`/api/v1/${kind}/${id}`, { method: 'PATCH', body: '{}' });
    await client.apiFetch(`/api/v1/${kind}/${id}`, { method: 'DELETE' });
  }
  await client.apiFetch('/api/v1/reminders/upcoming');
  await client.apiFetch('/api/v1/reminders/history');
  assert.equal(calls[0].body, body);
  assert.deepEqual(calls.map(c => c.method), ['POST', 'PATCH', 'DELETE', 'PATCH', 'DELETE', 'GET', 'GET']);
  for (const index of [2, 4]) assert.equal(Object.hasOwn(calls[index], 'body'), false);
});

test('event/reminder permissions reject bulk operations, malformed IDs and dispatch routes', async () => {
  const { client, calls } = await setup();
  await client.checkSession();
  const id = '00000000-0000-4000-8000-000000000001';
  for (const [path, method] of [
    ['/api/v1/contact-events', 'POST'], ['/api/v1/reminders', 'POST'],
    ['/api/v1/reminders', 'DELETE'], ['/api/v1/contact-events', 'DELETE'],
    ['/api/v1/reminders/upcoming', 'DELETE'], ['/api/v1/reminders/history', 'PATCH'],
    ['/api/v1/reminders/not-a-uuid', 'DELETE'],
    [`/api/v1/reminders/${id}/send`, 'POST'], [`/api/v1/contact-events/${id}`, 'POST'],
    [`/api/v1/people/${id}/contact-events`, 'DELETE'],
    [`/api/v1/people/invalid/contact-events`, 'POST'],
    [`/api/v1/people/${id}/contact-events/`, 'POST'],
    [`/api/v1/contact-events/${id}`, 'PUT'],
  ]) await assert.rejects(client.apiFetch(path, { method }));
  assert.equal(calls.length, 0);
});


test('contact channels preserve editable routing fields and support bodyless deletion', async () => {
  const { client, calls } = await setup();
  await client.checkSession();
  const id = '00000000-0000-4000-8000-000000000001';
  const payload = JSON.stringify({ platform: 'EMAIL', address: 'test@example.invalid',
    isPreferred: true, priority: 2, isActive: false, automationAllowed: false, notes: 'Test' });
  await client.apiFetch(`/api/v1/people/${id}/contact-channels`, { method: 'POST', body: payload });
  await client.apiFetch(`/api/v1/contact-channels/${id}`, { method: 'PATCH', body: payload });
  await client.apiFetch(`/api/v1/contact-channels/${id}`, { method: 'DELETE' });
  assert.deepEqual(calls.map(c => c.method), ['POST', 'PATCH', 'DELETE']);
  assert.equal(calls[0].body, payload);
  assert.equal(calls[1].body, payload);
  assert.equal(Object.hasOwn(calls[2], 'body'), false);
});

test('channel access cannot delete collections, send messages or mutate malformed paths', async () => {
  const { client, calls } = await setup();
  await client.checkSession();
  const id = '00000000-0000-4000-8000-000000000001';
  for (const [path, method] of [
    ['/api/v1/contact-channels', 'DELETE'], ['/api/v1/contact-channels', 'POST'],
    [`/api/v1/people/${id}/contact-channels`, 'DELETE'],
    [`/api/v1/people/${id}/contact-channels`, 'PATCH'],
    ['/api/v1/people/invalid/contact-channels', 'POST'],
    ['/api/v1/contact-channels/invalid', 'PATCH'],
    [`/api/v1/contact-channels/${id}/`, 'DELETE'],
    [`/api/v1/contact-channels/${id}`, 'POST'],
    [`/api/v1/contact-channels/${id}`, 'PUT'],
    [`/api/v1/contact-channels/${id}/send`, 'POST'],
    ['/api/v1/messages', 'POST'], [`/api/v1/people/${id}`, 'DELETE'],
  ]) await assert.rejects(client.apiFetch(path, { method }));
  assert.equal(calls.length, 0);
});


const photoEndpoint = '/api/v1/people/00000000-0000-4000-8000-000000000001/photo';
function imageForm(type = 'image/png', bytes = new Uint8Array([137,80,78,71,13,10,26,10])) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type }), 'private-name.png');
  return form;
}
test('photo upload carries exact bytes and MIME without filename or credentials; removal is bodyless', async () => {
  const { client, calls } = await setup();
  await client.checkSession();
  const form = imageForm();
  await client.apiFetch(photoEndpoint, { method: 'POST', body: form });
  assert.equal(calls[0].photo.base64, 'iVBORw0KGgo=');
  assert.equal(calls[0].photo.mimeType, 'image/png');
  assert.deepEqual(Object.keys(calls[0]).sort(), ['id', 'method', 'path', 'photo']);
  assert.deepEqual(Object.keys(calls[0].photo).sort(), ['base64', 'mimeType']);
  await client.apiFetch(photoEndpoint, { method: 'DELETE' });
  assert.equal(Object.hasOwn(calls[1], 'body'), false);
  assert.equal(Object.hasOwn(calls[1], 'photo'), false);
});

test('photo upload rejects unsupported files, extra parts, size violations and arbitrary multipart routes', async () => {
  const { client, calls } = await setup();
  await client.checkSession();
  const extra = imageForm(); extra.append('note', 'extra');
  const duplicate = imageForm(); duplicate.append('file', new Blob(['x']));
  const text = new FormData(); text.append('file', 'text');
  for (const body of [new FormData(), extra, duplicate, text, '{}',
    imageForm('image/svg+xml'), imageForm('image/heic'),
    imageForm('image/png', new Uint8Array()),
    imageForm('image/png', new Uint8Array(5 * 1024 * 1024 + 1))]) {
    await assert.rejects(client.apiFetch(photoEndpoint, { method: 'POST', body }));
  }
  await assert.rejects(client.apiFetch('/api/v1/people', { method: 'POST', body: imageForm() }));
  await assert.rejects(client.apiFetch(photoEndpoint, { method: 'POST', body: imageForm(), headers: { 'Content-Type': 'multipart/form-data' } }));
  await assert.rejects(client.apiFetch(photoEndpoint, { method: 'PATCH', body: '{}' }));
  assert.equal(calls.length, 0);
});

test('abort or logout during image encoding prevents native upload', async () => {
  for (const mode of ['abort', 'logout']) {
    const { client, calls } = await setup();
    await client.checkSession();
    const form = imageForm();
    let complete;
    form.get('file').arrayBuffer = () => new Promise(resolve => { complete = resolve; });
    const controller = new AbortController();
    const pending = client.apiFetch(photoEndpoint, { method: 'POST', body: form, signal: controller.signal });
    if (mode === 'abort') controller.abort(); else await client.signOut();
    complete(new Uint8Array([137,80,78,71,13,10,26,10]).buffer);
    await assert.rejects(pending);
    assert.equal(calls.filter(call => call.method === 'POST').length, 0);
  }
});

test('expired photo upload is attempted once and never automatically replayed', async () => {
  let requests = 0;
  const { client } = await setup({ request: async () => {
    requests++;
    throw Object.assign(new Error('Expired'), { code: 'SESSION_EXPIRED' });
  } });
  await client.checkSession();
  await assert.rejects(client.apiFetch(photoEndpoint, { method: 'POST', body: imageForm() }));
  await assert.rejects(client.apiFetch(photoEndpoint, { method: 'POST', body: imageForm() }), /Authentication required/);
  assert.equal(requests, 1);
});
