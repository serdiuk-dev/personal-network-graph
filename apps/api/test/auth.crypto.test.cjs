const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const c = require('../dist/auth/crypto');

test('RFC 6238 vector, bounded drift, malformed codes', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  assert.equal(c.validStep(secret, '287082', 59_000), 1n);
  assert.equal(c.validStep(secret, '287082', 89_000), 1n);
  assert.equal(c.validStep(secret, '287082', 119_000), null);
  assert.equal(c.validStep(secret, '287082x', 59_000), null);
});
test('TOTP encryption rejects a different key and tampered ciphertext', () => {
  const key = randomBytes(32);
  const sealed = c.seal('private factor', key);
  assert.equal(c.unseal(sealed, key), 'private factor');
  assert.notEqual(c.seal('private factor', key), sealed);
  assert.throws(() => c.unseal(sealed, randomBytes(32)));
  const parts = sealed.split(':');
  parts[3] = (parts[3][0] === 'a' ? 'b' : 'a') + parts[3].slice(1);
  assert.throws(() => c.unseal(parts.join(':'), key));
});
test('Argon2id uses independent salts and rejects a wrong password', async () => {
  const password = randomBytes(32).toString('hex');
  const first = await c.hashPassword(password);
  const second = await c.hashPassword(password);
  assert.match(first, /^\$argon2id\$v=19\$/);
  assert.deepEqual(first.split('$')[3].split(',').sort(), ['m=65536', 'p=1', 't=3']);
  assert.notEqual(first, second);
  assert.equal(await c.verifyPassword(first, password), true);
  assert.equal(await c.verifyPassword(first, 'incorrect'), false);
});
test('cookie ambiguity and CSRF forgery are rejected', () => {
  const token = c.randomToken(), key = randomBytes(32);
  assert.equal(c.sessionCookie(`${c.COOKIE}=${token}`), token);
  assert.equal(c.sessionCookie(`${c.COOKIE}=${token}; ${c.COOKIE}=${token}`), null);
  assert.equal(c.sessionCookie(`${c.COOKIE}=short`), null);
  assert.equal(c.sessionCookie(undefined), null);
  assert.notEqual(c.csrfFor(token, key), c.csrfFor(c.randomToken(), key));
  assert.notEqual(c.csrfFor(token, key), c.csrfFor(token, randomBytes(32)));
});
test('public origin configuration fails closed', () => {
  const before = process.env.PNET_PUBLIC_ORIGIN;
  try {
    for (const value of ['http://example.test', 'https://example.test/path', 'https://a:b@example.test', 'https://example.test/']) {
      process.env.PNET_PUBLIC_ORIGIN = value;
      assert.throws(c.publicOrigin);
    }
    delete process.env.PNET_PUBLIC_ORIGIN;
    assert.throws(c.publicOrigin);
    process.env.PNET_PUBLIC_ORIGIN = 'https://example.test';
    assert.equal(c.publicOrigin(), 'https://example.test');
  } finally {
    if (before === undefined) delete process.env.PNET_PUBLIC_ORIGIN; else process.env.PNET_PUBLIC_ORIGIN = before;
  }
});
