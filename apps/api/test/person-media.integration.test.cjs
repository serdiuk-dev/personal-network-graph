require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readdir, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const sharp = require('sharp');
assert.equal(process.env.PNET_AUTH_TEST, 'isolated');
const database = new URL(process.env.DATABASE_URL || '');
assert.equal(database.pathname, '/pnet_auth_test');
assert.ok(['db', '127.0.0.1'].includes(database.hostname));
const { PrismaService } = require('../dist/prisma.service');
const { PersonMediaService } = require('../dist/person-media/person-media.service');

test('real PostgreSQL row locks: concurrent photo upload and person deletion leave no orphan', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pnet-media-db-test-'));
  process.env.PNET_MEDIA_DIR = directory;
  const prisma = new PrismaService();
  let id;
  try {
    await prisma.$connect();
    const media = new PersonMediaService(prisma);
    const person = await prisma.person.create({ data: { firstName: 'Isolated media test' } });
    id = person.id;
    const buffer = await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 0.5 } } }).png().toBuffer();
    await media.upload(id, { buffer, size: buffer.length });
    const [upload, deletion] = await Promise.allSettled([
      media.upload(id, { buffer, size: buffer.length }), media.removePerson(id),
    ]);
    assert.equal(deletion.status, 'fulfilled');
    if (upload.status === 'rejected') assert.equal(upload.reason.getStatus(), 404);
    assert.equal(await prisma.person.findUnique({ where: { id } }), null);
    assert.deepEqual(await readdir(directory), []);
    await assert.rejects(media.get(id), error => error.getStatus() === 404);
  } finally {
    if (id) await prisma.person.deleteMany({ where: { id } });
    await prisma.$disconnect();
    await rm(directory, { recursive: true, force: true });
    delete process.env.PNET_MEDIA_DIR;
  }
});
