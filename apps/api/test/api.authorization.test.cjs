require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { NestFactory, ModulesContainer } = require('@nestjs/core');
const { RequestMethod } = require('@nestjs/common');
const { SchedulerRegistry } = require('@nestjs/schedule');
const { PATH_METADATA, METHOD_METADATA } = require('@nestjs/common/constants');

assert.equal(process.env.PNET_AUTH_TEST, 'isolated');
const url = new URL(process.env.DATABASE_URL || '');
assert.equal(url.pathname, '/pnet_auth_test');
assert.ok(['db', '127.0.0.1'].includes(url.hostname));
process.env.PNET_PUBLIC_ORIGIN = 'https://owner.example.test';
const folder = mkdtempSync(join(tmpdir(), 'pnet-route-test-'));
process.env.PNET_AUTH_KEY_FILE = join(folder, 'key');
writeFileSync(process.env.PNET_AUTH_KEY_FILE, randomBytes(32).toString('hex'), { mode: 0o600 });
// Test container has no provider credentials. Never import production environment.
for (const name of ['TELEGRAM_BOT_TOKEN', 'SMTP_HOST', 'SMTP_PASS', 'SMTP_USER', 'NOTIFICATION_TELEGRAM_CHAT_ID', 'NOTIFICATION_EMAIL_TO']) assert.ok(!process.env[name]);
const { AppModule } = require('../dist/app.module');

test('every actual application controller route is closed except health and login', async t => {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  await app.init();
  for (const job of app.get(SchedulerRegistry).getCronJobs().values()) job.stop();
  await app.listen(0, '127.0.0.1');
  t.after(() => app.close());
  const base = await app.getUrl();
  const publicRoutes = [];
  let count = 0;
  for (const module of app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const Type = wrapper.metatype;
      const prefix = Reflect.getMetadata(PATH_METADATA, Type) || '';
      for (const name of Object.getOwnPropertyNames(Type.prototype)) {
        const handler = Type.prototype[name];
        if (typeof handler !== 'function' || !Reflect.hasMetadata(METHOD_METADATA, handler)) continue;
        const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler)];
        const path = '/api/v1/' + [prefix, Reflect.getMetadata(PATH_METADATA, handler)].filter(Boolean).map(x => x.replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/').replace(/:([A-Za-z0-9_]+)/g, '00000000-0000-4000-8000-000000000001');
        if (Reflect.getMetadata('pnet:public', handler)) { publicRoutes.push(`${method} ${path}`); continue; }
        const response = await fetch(base + path, { method, headers: { Origin: process.env.PNET_PUBLIC_ORIGIN, 'Content-Type': 'application/json' }, ...(!['GET', 'HEAD'].includes(method) ? { body: '{}' } : {}) });
        assert.equal(response.status, 401, `${method} ${path}`);
        count++;
      }
    }
  }
  assert.deepEqual(publicRoutes.sort(), ['GET /api/v1/health', 'POST /api/v1/auth/login']);
  assert.ok(count >= 30, `Unexpected protected route count: ${count}`);
  assert.equal((await fetch(base + '/api/v1/health')).status, 200);
  console.log(`Protected actual routes checked: ${count}`);
});
