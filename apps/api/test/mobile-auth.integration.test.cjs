require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Module, ValidationPipe } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { PrismaClient } = require('@prisma/client');
const { AuthModule } = require('../dist/auth/auth.module');
const { saveOwner, newRecoveryCodes } = require('../dist/auth/owner-admin');
const c = require('../dist/auth/crypto');
const { MOBILE_IDLE_MS } = require('../dist/auth/mobile-auth.service');
assert.equal(process.env.PNET_AUTH_TEST, 'isolated');
const url = new URL(process.env.DATABASE_URL || '');
assert.equal(url.pathname, '/pnet_auth_test');
assert.ok(['db', '127.0.0.1'].includes(url.hostname));
for (const name of ['TELEGRAM_BOT_TOKEN', 'SMTP_HOST', 'SMTP_PASS', 'SMTP_USER']) assert.ok(!process.env[name]);
const origin = 'https://owner.example.test';
process.env.PNET_PUBLIC_ORIGIN = origin;
const key = randomBytes(32), dir = mkdtempSync(join(tmpdir(), 'pnet-mobile-test-'));
process.env.PNET_AUTH_KEY_FILE = join(dir, 'key');
writeFileSync(process.env.PNET_AUTH_KEY_FILE, key.toString('hex'), { mode: 0o600 });
class Fixture {}
Module({ imports: [AuthModule] })(Fixture);

test('isolated PostgreSQL: device enrollment, rotation, replay, expiry and revocation', async t => {
  const prisma = new PrismaClient({ log: [] });
  await prisma.$connect();
  assert.equal((await prisma.$queryRaw`SELECT current_database() AS name`)[0].name, 'pnet_auth_test');
  await prisma.owner.deleteMany(); await prisma.authAttempt.deleteMany();
  const input = { login: 'test-owner', password: randomBytes(24).toString('hex'),
    secret: require('otpauth').Secret.fromHex(randomBytes(20).toString('hex')).base32,
    step: -1n, codes: newRecoveryCodes(), key };
  await saveOwner(prisma, 'bootstrap', input);
  const app = await NestFactory.create(Fixture, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true,
    validationError: { target: false, value: false } }));
  await app.listen(0, '127.0.0.1');
  t.after(async () => { await app.close(); await prisma.$disconnect(); });
  const base = (await app.getUrl()) + '/api/v1/auth';
  const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const headers = s => ({ Cookie: s.cookie, 'X-Pnet-CSRF': s.csrf });
  const valid = async r => { assert.equal(r.status, 200, await r.clone().text()); return r.json(); };
  const full = async (code) => {
    // Fixture control only: avoids waiting for real clock steps between independent cases.
    await prisma.owner.update({ where: { id: 1 }, data: { lastTotpStep: -1n } });
    await prisma.authAttempt.deleteMany();
    const response = await post('/login', { login: input.login, password: input.password, code: code || c.totp(input.secret).generate() });
    const result = await valid(response);
    assert.equal(result.token, undefined); // WEB contract unchanged.
    assert.match(response.headers.get('set-cookie'), /Max-Age=43200$/);
    return { cookie: response.headers.get('set-cookie').split(';')[0], csrf: result.csrf };
  };
  const enroll = async () => {
    const web = await full();
    const result = await valid(await post('/mobile/enroll', { name: 'Test iPhone' }, headers(web)));
    const access = { cookie: c.COOKIE + '=' + result.token, csrf: result.csrf };
    return { ...result, access, web };
  };
  const read = s => fetch(base + '/session', { headers: { Cookie: s.cookie } });
  const devices = s => fetch(base + '/mobile/devices', { headers: { Cookie: s.cookie } });
  const renew = token => post('/mobile/refresh', { refreshToken: token });
  await t.test('entry points reject missing secrets, bad Origin and unexpected fields', async () => {
    assert.equal((await post('/mobile/enroll', { name: 'Test' })).status, 401);
    assert.equal((await post('/mobile/refresh', {})).status, 400);
    assert.equal((await post('/mobile/refresh', { refreshToken: c.randomToken() }, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await post('/mobile/refresh', { refreshToken: c.randomToken(), extra: true })).status, 400);
    assert.equal((await renew(c.randomToken())).status, 401);
    assert.equal((await post('/mobile/disconnect', {})).status, 400);
  });
  await t.test('enrollment needs fresh full authentication and valid CSRF', async () => {
    const web = await full();
    assert.equal((await post('/mobile/enroll', { name: 'Test' }, { Cookie: web.cookie })).status, 403);
    const tokenHash = c.hashToken(web.cookie.split('=')[1]);
    await prisma.ownerSession.update({ where: { tokenHash }, data: { createdAt: new Date(Date.now() - 121_000) } });
    assert.equal((await post('/mobile/enroll', { name: 'Test' }, headers(web))).status, 401);
  });
  await t.test('mobile session is short, WEB handoff consumed, and mobile cannot administer devices', async () => {
    const phone = await enroll();
    assert.equal((await read(phone.web)).status, 401);
    assert.equal((await read(phone.access)).status, 200);
    assert.ok(Date.parse(phone.expiresAt) - Date.now() <= 900_000);
    assert.equal((await devices(phone.access)).status, 403);
    assert.equal((await post('/mobile/enroll', { name: 'Another' }, headers(phone.access))).status, 401);
    const stored = await prisma.mobileRefresh.findFirst({ where: { tokenHash: c.hashToken(phone.refreshToken) } });
    assert.ok(stored); assert.notEqual(stored.tokenHash, phone.refreshToken);
    const web = await full();
    const list = await valid(await devices(web));
    assert.ok(list.length); assert.equal(list[0].credentials, undefined);
    assert.equal((await post(`/mobile/devices/${list[0].id}/revoke`, {}, { Cookie: web.cookie })).status, 403);
    await valid(await post(`/mobile/devices/${list[0].id}/revoke`, {}, headers(web)));
    assert.equal((await read(phone.access)).status, 401);
    assert.equal((await renew(phone.refreshToken)).status, 401);
    assert.equal((await read(web)).status, 200);
  });
  await t.test('rotation revokes old access and replay commits revocation of the whole device', async () => {
    const phone = await enroll();
    const next = await valid(await renew(phone.refreshToken));
    assert.notEqual(next.refreshToken, phone.refreshToken);
    assert.equal((await read(phone.access)).status, 401);
    const access = { cookie: c.COOKIE + '=' + next.token };
    assert.equal((await read(access)).status, 200);
    assert.equal((await renew(phone.refreshToken)).status, 401);
    assert.equal((await read(access)).status, 401);
    assert.equal((await renew(next.refreshToken)).status, 401);
  });
  await t.test('concurrent refresh replay allows at most one issuance and then revokes it', async () => {
    const phone = await enroll();
    const results = await Promise.all([renew(phone.refreshToken), renew(phone.refreshToken)]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 401]);
    const issued = await results.find(r => r.status === 200).json();
    assert.equal((await renew(issued.refreshToken)).status, 401);
  });
  await t.test('expired access can renew; absolute and idle device expiry cannot', async () => {
    let phone = await enroll();
    await prisma.ownerSession.update({ where: { tokenHash: c.hashToken(phone.token) }, data: { expiresAt: new Date(0) } });
    assert.equal((await read(phone.access)).status, 401);
    await valid(await renew(phone.refreshToken));
    phone = await enroll();
    let record = await prisma.mobileRefresh.findUnique({ where: { tokenHash: c.hashToken(phone.refreshToken) } });
    await prisma.mobileDevice.update({ where: { id: record.deviceId }, data: { expiresAt: new Date(0) } });
    assert.equal((await renew(phone.refreshToken)).status, 401);
    phone = await enroll();
    record = await prisma.mobileRefresh.findUnique({ where: { tokenHash: c.hashToken(phone.refreshToken) } });
    await prisma.mobileDevice.update({ where: { id: record.deviceId }, data: { lastUsedAt: new Date(Date.now() - MOBILE_IDLE_MS - 1000) } });
    assert.equal((await renew(phone.refreshToken)).status, 401);
  });
  await t.test('disconnect revokes both renewal and active access', async () => {
    const phone = await enroll();
    await valid(await post('/mobile/disconnect', { refreshToken: phone.refreshToken }));
    assert.equal((await read(phone.access)).status, 401);
    assert.equal((await renew(phone.refreshToken)).status, 401);
  });
  await t.test('recovery and operator reset revoke every mobile device', async () => {
    let phone = await enroll();
    await full(input.codes[0]);
    assert.equal(await prisma.mobileDevice.count(), 0);
    assert.equal((await renew(phone.refreshToken)).status, 401);
    phone = await enroll();
    await saveOwner(prisma, 'reset', { ...input, codes: newRecoveryCodes() });
    assert.equal(await prisma.mobileDevice.count(), 0);
    assert.equal((await read(phone.access)).status, 401);
    assert.equal((await renew(phone.refreshToken)).status, 401);
  });
  await t.test('device limit and persistent refresh limit are enforced', async () => {
    for (let i = 0; i < 5; i++) await enroll();
    const web = await full();
    assert.equal((await post('/mobile/enroll', { name: 'Sixth' }, headers(web))).status, 409);
    await prisma.authAttempt.deleteMany();
    for (let i = 0; i < 60; i++) assert.equal((await renew(c.randomToken())).status, 401);
    assert.equal((await renew(c.randomToken())).status, 429);
  });
});
