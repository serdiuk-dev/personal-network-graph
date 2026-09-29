import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { closeSync, fsyncSync, openSync, statSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { readKey, totp, validStep } from './crypto';
import { newRecoveryCodes, saveOwner } from './owner-admin';

export function hidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let value = '';
    process.stdin.setEncoding('utf8');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const done = (error?: Error) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off('data', receive);
      process.stdout.write('\n');
      if (error) reject(error); else resolve(value);
    };
    const receive = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\u0003' || char === '\u0004') return done(new Error('Cancelled'));
        if (char === '\r' || char === '\n') return done();
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ' && value.length < 256) value += char;
      }
    };
    process.stdin.on('data', receive);
    process.stdout.write(prompt);
  });
}
async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Interactive terminal required');
  const mode = process.argv[2];
  if (!['bootstrap', 'reset', 'revoke'].includes(mode) || process.argv.length !== 3) throw new Error('Invalid command');
  const prisma = new PrismaClient({ log: [] });
  try {
    await prisma.$connect();
    if (mode === 'revoke') {
      await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "Owner" WHERE "id" = 1 FOR UPDATE`;
        await tx.ownerSession.deleteMany();
      });
      console.log('All owner sessions revoked.');
      return;
    }
    const key = readKey();
    const current = await prisma.owner.findUnique({ where: { id: 1 }, select: { id: true } });
    if ((mode === 'bootstrap') === !!current) throw new Error('Owner state does not match command');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const login = (await rl.question('Owner login (3–64 lowercase ASCII characters): ')).trim();
    rl.close();
    if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(login)) throw new Error('Invalid login');
    const password = await hidden('New password (16–128 characters; not echoed): ');
    if (password.length < 16 || password.length > 128) throw new Error('Invalid password length');
    if (password !== await hidden('Repeat password: ')) throw new Error('Passwords differ');
    const folder = '/owner-setup';
    const info = statSync(folder);
    if (!info.isDirectory() || (info.mode & 0o077) !== 0 || info.uid !== process.getuid!()) throw new Error('Private setup directory required');
    const secret = randomBytes(20).toString('hex');
    // OTPAuth accepts a base32 secret; convert random bytes through its Secret type.
    const { Secret } = await import('otpauth');
    const base32 = Secret.fromHex(secret).base32;
    const codes = newRecoveryCodes();
    const filename = `${folder}/provisioning.txt`;
    const fd = openSync(filename, 'wx', 0o600);
    try {
      writeFileSync(fd, [
        'PRIVATE — store in your password manager; never upload or paste into chat.',
        'This material becomes active only after confirmation succeeds.',
        `Owner: ${login}`, `TOTP setup key: ${base32}`,
        `Authenticator URI: ${totp(base32, login).toString()}`,
        '', 'One-use recovery codes (password is still required):', ...codes, '',
      ].join('\n'));
      fsyncSync(fd);
    } finally { closeSync(fd); }
    console.log('Private provisioning file created at /owner-setup/provisioning.txt.');
    console.log('Retrieve it securely in a second terminal and configure your authenticator.');
    const code = await hidden('Current 6-digit authenticator code: ');
    const step = validStep(base32, code);
    if (step === null) throw new Error('Factor verification failed');
    await saveOwner(prisma, mode as 'bootstrap' | 'reset', { login, password, secret: base32, step, codes, key });
    console.log('Owner credentials saved. Wait for the next authenticator code before login.');
  } finally { await prisma.$disconnect(); }
}
if (require.main === module) main().catch(() => {
  console.error('Owner operation failed. Check command, owner state, private setup directory, credentials and database. No secret details are logged.');
  process.exitCode = 1;
});
