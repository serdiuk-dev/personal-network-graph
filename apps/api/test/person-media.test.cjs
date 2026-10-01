require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readdir, readFile, stat, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const sharp = require('sharp');
const { Module, UnauthorizedException } = require('@nestjs/common');
const { NestFactory, APP_GUARD, APP_FILTER } = require('@nestjs/core');
const { AuthGuard } = require('../dist/auth/auth.guard');
const { AuthService } = require('../dist/auth/auth.service');
const { SafeErrorsFilter } = require('../dist/auth/safe-errors.filter');
const { PersonMediaController } = require('../dist/person-media/person-media.controller');
const { PersonMediaService } = require('../dist/person-media/person-media.service');
const { PrismaService } = require('../dist/prisma.service');
const id = '10000000-0000-4000-8000-000000000001';
const missingId = '10000000-0000-4000-8000-000000000002';
const origin = 'https://owner.example.test';
const token = 'a'.repeat(64), csrf = 'b'.repeat(64);

// Real routes, guard, multipart, decoder and filesystem; session persistence
// and Prisma are test doubles. No database or production credentials are used.
test('private contact images: HTTP authorization, upload limits and file lifecycle', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'pnet-media-test-'));
  process.env.PNET_MEDIA_DIR = directory;
  let exists = true, failDelete = false;
  const prisma = {
    person: {
      findUnique: async ({ where }) => exists && where.id === id ? { id } : null,
      delete: async () => { if (failDelete) throw new Error('DB unavailable'); exists = false; return { id }; },
    },
    $queryRaw: async (_sql, requested) => exists && requested === id ? [{ id }] : [],
    $transaction: async action => action(prisma),
  };
  const auth = { origin, csrf: () => csrf, authenticate: async value => { if (value !== token) throw new UnauthorizedException(); } };
  class TestModule {}
  Module({ controllers: [PersonMediaController], providers: [PersonMediaService,
    { provide: PrismaService, useValue: prisma }, { provide: AuthService, useValue: auth },
    { provide: APP_GUARD, useClass: AuthGuard }, { provide: APP_FILTER, useClass: SafeErrorsFilter },
  ] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  await app.listen(0, '127.0.0.1');
  t.after(async () => { await app.close(); await rm(directory, { recursive: true, force: true }); delete process.env.PNET_MEDIA_DIR; });
  const base = `${await app.getUrl()}/api/v1/people/${id}/photo`;
  const headers = { Cookie: `__Host-pnet_session=${token}`, Origin: origin, 'X-Pnet-CSRF': csrf };
  const upload = (bytes, name = 'photo.png', mime = 'image/png', extra = {}) => {
    const body = new FormData(); body.append('file', new Blob([bytes], { type: mime }), name);
    return fetch(base, { method: 'POST', headers: { ...headers, ...extra }, body });
  };
  const png = await sharp({ create: { width: 800, height: 400, channels: 4, background: { r: 25, g: 50, b: 75, alpha: 0.5 } } }).png().toBuffer();

  await t.test('owner session, CSRF and Origin required', async () => {
    for (const method of ['GET', 'POST', 'DELETE']) assert.equal((await fetch(base, { method })).status, 401);
    assert.equal((await upload(png, 'photo.png', 'image/png', { 'X-Pnet-CSRF': '' })).status, 403);
    assert.equal((await upload(png, 'photo.png', 'image/png', { Origin: 'https://other.example' })).status, 403);
    assert.equal((await fetch(base, { headers: { Cookie: '__Host-pnet_session=' + 'c'.repeat(64) } })).status, 401);
    assert.deepEqual(await readdir(directory), []);
  });
  await t.test('upload, retrieval, resize, alpha and private permissions', async () => {
    const response = await upload(png, '../../escape.png', 'application/octet-stream');
    assert.equal(response.status, 201, await response.text());
    const result = await fetch(base, { headers });
    assert.equal(result.status, 200);
    assert.match(result.headers.get('cache-control'), /no-store/);
    assert.equal(result.headers.get('content-type'), 'image/webp');
    const meta = await sharp(Buffer.from(await result.arrayBuffer())).metadata();
    assert.equal(meta.width, 512); assert.equal(meta.height, 256); assert.equal(meta.hasAlpha, true);
    assert.deepEqual(await readdir(directory), [`${id}.webp`]);
    assert.equal((await stat(join(directory, `${id}.webp`))).mode & 0o777, 0o600);
  });
  await t.test('invalid, disguised, oversized and excess data preserve the old photo', async () => {
    const before = await readFile(join(directory, `${id}.webp`));
    assert.equal((await upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).status, 415);
    assert.equal((await upload(png.subarray(0, 40))).status, 400);
    assert.equal((await upload(Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413);
    const tooManyPixels = await sharp({ create: { width: 5100, height: 5000, channels: 3, background: 'white' } }).png().toBuffer();
    assert.equal((await upload(tooManyPixels)).status, 400);
    const animation = Buffer.from('UklGRsQAAABXRUJQVlA4WAoAAAACAAAAAgAAAgAAQU5JTQYAAAAAAAAAAABBTk1GSgAAAAAAAAAAAAIAAAIAAGQAAAJWUDggMgAAADABAJ0BKgMAAwABQCYloAADcAD+8ut///mwP/bz/wR6Af//0uD//pcH//S4P/SkAAAAQU5NRkYAAAAAAAAAAAACAAACAABkAAAAVlA4IC4AAAA0AQCdASoDAAMAAAAmJaAAA3AA/vtV4///S4P/+lwf/9Lg/9Lg//rV5Vesq6AA', 'base64');
    assert.equal((await sharp(animation).metadata()).pages, 2);
    assert.equal((await upload(animation, 'animated.webp', 'image/webp')).status, 400);
    const body = new FormData(); body.append('file', new Blob([png]), 'a.png'); body.append('file', new Blob([png]), 'b.png');
    assert.equal((await fetch(base, { method: 'POST', headers, body })).status, 400);
    assert.deepEqual(await readFile(join(directory, `${id}.webp`)), before);
  });
  await t.test('JPEG replacement removes metadata and obsolete files', async () => {
    const jpeg = await sharp({ create: { width: 30, height: 60, channels: 3, background: 'red' } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const response = await upload(jpeg, 'new.jpg', 'image/jpeg');
    assert.equal(response.status, 201, await response.text());
    const meta = await sharp(await readFile(join(directory, `${id}.webp`))).metadata();
    assert.equal(meta.width, 60); assert.equal(meta.height, 30); assert.equal(meta.exif, undefined); assert.equal(meta.orientation, undefined);
    assert.deepEqual(await readdir(directory), [`${id}.webp`]);
  });
  await t.test('missing contacts and invalid IDs cannot create files', async () => {
    const body = new FormData(); body.append('file', new Blob([png]), 'a.png');
    assert.equal((await fetch(base.replace(id, missingId), { method: 'POST', headers, body })).status, 404);
    assert.equal((await fetch(base.replace(id, 'bad-id'), { headers })).status, 400);
    assert.deepEqual(await readdir(directory), [`${id}.webp`]);
  });
  await t.test('idempotent removal; failed DB deletion preserves photo; successful deletion cleans it', async () => {
    assert.equal((await fetch(base, { method: 'DELETE', headers })).status, 200);
    assert.equal((await fetch(base, { method: 'DELETE', headers })).status, 200);
    assert.equal((await fetch(base, { headers })).status, 404);
    assert.deepEqual(await readdir(directory), []);
    assert.equal((await upload(png)).status, 201);
    failDelete = true;
    await assert.rejects(app.get(PersonMediaService).removePerson(id));
    assert.equal((await fetch(base, { headers })).status, 200);
    failDelete = false;
    await app.get(PersonMediaService).removePerson(id);
    assert.equal((await fetch(base, { headers })).status, 404);
    assert.equal((await upload(png)).status, 404);
    assert.deepEqual(await readdir(directory), []);
  });
});
