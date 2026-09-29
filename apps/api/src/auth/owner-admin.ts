import { PrismaClient } from '@prisma/client';
import { randomBytes, randomUUID } from 'node:crypto';
import { hashPassword, hashToken, seal } from './crypto';

export function newRecoveryCodes() {
  return Array.from({ length: 10 }, () => randomBytes(16).toString('hex'));
}
export async function saveOwner(prisma: PrismaClient, mode: 'bootstrap' | 'reset', input: {
  login: string; password: string; secret: string; step: bigint; codes: string[]; key: Buffer;
}) {
  const passwordHash = await hashPassword(input.password);
  const data = {
    login: input.login, passwordHash, totpEncrypted: seal(input.secret, input.key),
    lastTotpStep: input.step, recoveryHashes: input.codes.map(hashToken), version: randomUUID(),
  };
  await prisma.$transaction(async tx => {
    // Serializes even an empty installation: only server-side operators can call this.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(741041)`;
    const current = await tx.owner.findUnique({ where: { id: 1 } });
    if (mode === 'bootstrap') {
      if (current) throw new Error('Owner already exists; bootstrap is closed.');
      await tx.owner.create({ data: { id: 1, ...data } });
    } else {
      if (!current) throw new Error('Owner does not exist.');
      // Login and recovery use the same owner row lock.
      await tx.owner.update({ where: { id: 1 }, data });
      await tx.ownerSession.deleteMany({ where: { ownerId: 1 } });
    }
  });
}
