require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Module, Controller, Get, Post, ValidationPipe } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { PrismaClient } = require('@prisma/client');
const { AuthModule } = require('../dist/auth/auth.module');
const { saveOwner, newRecoveryCodes } = require('../dist/auth/owner-admin');
const c = require('../dist/auth/crypto');

const connection = new URL(process.env.DATABASE_URL || '');
assert.equal(process.env.PNET_AUTH_TEST, 'isolated');
assert.equal(connection.pathname, '/pnet_auth_test');
assert.ok(['db', '127.0.0.1'].includes(connection.hostname));
const origin = 'https://owner.example.test';
process.env.PNET_PUBLIC_ORIGIN = origin;
const key = randomBytes(32);
const folder = mkdtempSync(join(tmpdir(), 'pnet-auth-test-'));
process.env.PNET_AUTH_KEY_FILE = join(folder, 'key');
writeFileSync(process.env.PNET_AUTH_KEY_FILE, key.toString('hex'), { mode: 0o600 });
let writes = 0;
class PrivateController {
  read() { return { private: true }; }
  write() { writes++; return { changed: true }; }
}
Controller('private')(PrivateController);
Get()(PrivateController.prototype, 'read', Object.getOwnPropertyDescriptor(PrivateController.prototype, 'read'));
Post()(PrivateController.prototype, 'write', Object.getOwnPropertyDescriptor(PrivateController.prototype, 'write'));
class Fixture {}
Module({ imports: [AuthModule], controllers: [PrivateController] })(Fixture);

async function boot() {
  const app = await NestFactory.create(Fixture, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, validationError: { target: false, value: false } }));
  await app.listen(0, '127.0.0.1');
  return { app, base: await app.getUrl() };
}

test('real PostgreSQL: closed bootstrap, MFA, session lifecycle, CSRF, recovery and persistent limiting', async t => {
  const prisma = new PrismaClient({ log: [] });
  await prisma.$connect();
  assert.equal((await prisma.$queryRaw`SELECT current_database() AS name`)[0].name, 'pnet_auth_test');
  await prisma.ownerSession.deleteMany(); await prisma.owner.deleteMany(); await prisma.authAttempt.deleteMany();
  let server = await boot();
  t.after(async () => { await server.app.close(); await prisma.$disconnect(); });
  const call = (path, init = {}) => fetch(`${server.base}/api/v1/${path}`, { ...init, redirect: 'manual' });
  const input = { login: 'test-owner', password: randomBytes(24).toString('hex'), secret: randomBytes(20).toString('hex'), step: -1n, codes: newRecoveryCodes(), key };
  input.secret = require('otpauth').Secret.fromHex(input.secret).base32;
  const login = (code, overrides = {}, headers = {}) => call('auth/login', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ login: input.login, password: input.password, code, ...overrides }),
  });
  const clearAttempts = () => prisma.authAttempt.deleteMany();
  const session = async response => {
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200$/);
    const body = await response.json();
    assert.match(body.csrf, /^[a-f0-9]{64}$/);
    assert.equal(body.token, undefined);
    return { cookie: cookie.split(';')[0], csrf: body.csrf };
  };
  const mutate = (s, extra = {}) => call('private', { method: 'POST', headers: { Cookie: s.cookie, Origin: origin, 'X-Pnet-CSRF': s.csrf, ...extra } });

  await t.test('empty installation denies access and has no HTTP bootstrap or registration', async () => {
    assert.equal((await call('private')).status, 401);
    for (const path of ['auth/register', 'auth/setup', 'auth/bootstrap', 'auth/guest']) assert.equal((await call(path, { method: 'POST' })).status, 404);
    assert.equal((await login('000000')).status, 401);
  });
  await t.test('concurrent CLI bootstrap produces exactly one owner', async () => {
    const attempts = await Promise.allSettled([saveOwner(prisma, 'bootstrap', input), saveOwner(prisma, 'bootstrap', input)]);
    assert.equal(attempts.filter(x => x.status === 'fulfilled').length, 1);
    assert.equal(await prisma.owner.count(), 1);
    await assert.rejects(saveOwner(prisma, 'bootstrap', input));
  });
  await clearAttempts();
  await t.test('bad login and password have the same response; Origin and input validation', async () => {
    const a = await login('000000', { login: 'another-owner' });
    const b = await login('000000', { password: 'incorrect' });
    assert.equal(a.status, 401); assert.equal(b.status, 401);
    assert.deepEqual(await a.json(), await b.json());
    assert.equal((await login('000000', {}, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await login('000000', { unexpected: 'value' })).status, 400);
  });
  await clearAttempts();
  let first;
  await t.test('concurrent reuse of one TOTP succeeds only once', async () => {
    const code = c.totp(input.secret).generate();
    const results = await Promise.all([login(code), login(code)]);
    assert.deepEqual(results.map(x => x.status).sort(), [200, 401]);
    first = await session(results.find(x => x.status === 200));
    assert.equal((await login(code)).status, 401);
    const row = await prisma.ownerSession.findFirst();
    assert.notEqual(row.tokenHash, first.cookie.split('=')[1]);
    assert.equal(row.tokenHash, c.hashToken(first.cookie.split('=')[1]));
  });
  await t.test('authenticated read and CSRF enforcement before any write', async () => {
    assert.equal((await call('private', { headers: { Cookie: first.cookie } })).status, 200);
    assert.equal((await mutate(first, { 'X-Pnet-CSRF': '' })).status, 403);
    assert.equal((await mutate(first, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await mutate(first, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
    assert.equal((await mutate(first, { 'X-Pnet-CSRF': c.randomToken() })).status, 403);
    assert.equal(writes, 0);
    assert.equal((await mutate(first)).status, 201);
    assert.equal(writes, 1);
    assert.equal((await call('private', { headers: { Cookie: `${first.cookie}; ${first.cookie}` } })).status, 401);
  });
  await clearAttempts();
  let recovered;
  await t.test('concurrent recovery code use succeeds once and revokes previous sessions', async () => {
    const results = await Promise.all([login(input.codes[0]), login(input.codes[0])]);
    assert.deepEqual(results.map(x => x.status).sort(), [200, 401]);
    recovered = await session(results.find(x => x.status === 200));
    assert.equal((await call('private', { headers: { Cookie: first.cookie } })).status, 401);
    assert.equal((await prisma.owner.findUnique({ where: { id: 1 } })).recoveryHashes.length, 9);
    assert.equal((await login(input.codes[0])).status, 401);
  });
  await t.test('session survives API restart and logout revokes it on the server', async () => {
    await server.app.close(); server = await boot();
    assert.equal((await call('auth/session', { headers: { Cookie: recovered.cookie } })).status, 200);
    const out = await call('auth/logout', { method: 'POST', headers: { Cookie: recovered.cookie, Origin: origin, 'X-Pnet-CSRF': recovered.csrf } });
    assert.equal(out.status, 200); assert.match(out.headers.get('set-cookie'), /Max-Age=0/);
    assert.equal((await call('private', { headers: { Cookie: recovered.cookie } })).status, 401);
  });
  await clearAttempts();
  await t.test('absolute and idle expiry are enforced by the database', async () => {
    const expired = await session(await login(input.codes[1]));
    await prisma.ownerSession.updateMany({ data: { expiresAt: new Date(Date.now() - 1) } });
    assert.equal((await call('private', { headers: { Cookie: expired.cookie } })).status, 401);
    const idle = await session(await login(input.codes[2]));
    await prisma.ownerSession.updateMany({ data: { lastSeenAt: new Date(Date.now() - c.IDLE_MS - 1000) } });
    assert.equal((await call('private', { headers: { Cookie: idle.cookie } })).status, 401);
  });
  await clearAttempts();
  await t.test('operator reset rotates credentials, factor and recovery codes, and revokes sessions', async () => {
    const old = await session(await login(input.codes[3]));
    const previousCode = input.codes[4];
    const next = { ...input, password: randomBytes(24).toString('hex'), secret: require('otpauth').Secret.fromHex(randomBytes(20).toString('hex')).base32, codes: newRecoveryCodes() };
    const version = (await prisma.owner.findUnique({ where: { id: 1 } })).version;
    await saveOwner(prisma, 'reset', next);
    assert.notEqual((await prisma.owner.findUnique({ where: { id: 1 } })).version, version);
    assert.equal((await call('private', { headers: { Cookie: old.cookie } })).status, 401);
    assert.equal((await login(previousCode)).status, 401);
    Object.assign(input, next);
    assert.equal((await login(previousCode)).status, 401);
    assert.equal((await login(input.codes[0])).status, 200);
  });
  await clearAttempts();
  await t.test('login limit persists through process restart and ignores spoofed proxy headers', async () => {
    for (let index = 0; index < 10; index++) assert.equal((await login('000000', { password: 'incorrect' }, { 'X-Forwarded-For': `192.0.2.${index}` })).status, 401);
    assert.equal((await login('000000')).status, 429);
    await server.app.close(); server = await boot();
    assert.equal((await login('000000', {}, { 'X-Forwarded-For': '198.51.100.1' })).status, 429);
    assert.equal(await prisma.authAttempt.count(), 2);
  });
});
