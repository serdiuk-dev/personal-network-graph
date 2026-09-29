import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import * as argon2 from 'argon2';
import * as OTPAuth from 'otpauth';

export const COOKIE = '__Host-pnet_session';
export const IDLE_MS = 30 * 60_000;
export const MAX_MS = 12 * 60 * 60_000;
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
export const randomToken = () => randomBytes(32).toString('hex');
export const hashPassword = (password: string) => argon2.hash(password, {
  type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1,
});
export const verifyPassword = (hash: string, password: string) => argon2.verify(hash, password);

export function readKey(): Buffer {
  const path = process.env.PNET_AUTH_KEY_FILE;
  if (!path) throw new Error('PNET_AUTH_KEY_FILE is required');
  const info = statSync(path);
  if (!info.isFile() || info.size > 256) throw new Error('Invalid auth key file');
  const encoded = readFileSync(path, 'utf8').trim();
  if (!/^[a-f0-9]{64}$/i.test(encoded)) throw new Error('Auth key must be 32 random bytes encoded as hex');
  return Buffer.from(encoded, 'hex');
}

export function publicOrigin(): string {
  const source = process.env.PNET_PUBLIC_ORIGIN;
  if (!source) throw new Error('PNET_PUBLIC_ORIGIN is required');
  const url = new URL(source);
  if (url.protocol !== 'https:' || url.origin !== source || url.username || url.password) {
    throw new Error('PNET_PUBLIC_ORIGIN must be an HTTPS origin without a path');
  }
  return url.origin;
}

export function seal(secret: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from('pnet-owner-totp-v1'));
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('hex'), cipher.getAuthTag().toString('hex'), ciphertext.toString('hex')].join(':');
}

export function unseal(value: string, key: Buffer): string {
  const [version, iv, tag, ciphertext] = value.split(':');
  if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('Invalid encrypted factor');
  const cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  cipher.setAAD(Buffer.from('pnet-owner-totp-v1'));
  cipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([cipher.update(Buffer.from(ciphertext, 'hex')), cipher.final()]).toString('utf8');
}

export function totp(secret: string, label = 'Owner') {
  return new OTPAuth.TOTP({ issuer: 'Personal Network', label, algorithm: 'SHA1', digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) });
}

export function validStep(secret: string, code: string, now = Date.now()): bigint | null {
  if (!/^\d{6}$/.test(code)) return null;
  const delta = totp(secret).validate({ token: code, window: 1, timestamp: now });
  return delta === null ? null : BigInt(Math.floor(now / 30_000) + delta);
}

export function same(a: string, b: string): boolean {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export const csrfFor = (token: string, key: Buffer) => createHmac('sha256', key).update('csrf:' + token).digest('hex');

export function sessionCookie(header: string | undefined): string | null {
  const values = (header ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(COOKIE + '='));
  if (values.length !== 1) return null;
  const value = values[0].slice(COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}
