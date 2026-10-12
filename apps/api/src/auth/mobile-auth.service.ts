import { ForbiddenException, HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { hashToken, randomToken } from './crypto';

export const MOBILE_ACCESS_MS = 15 * 60_000;
export const MOBILE_TRUST_MS = 30 * 24 * 60 * 60_000;
export const MOBILE_IDLE_MS = 7 * 24 * 60 * 60_000;

@Injectable()
export class MobileAuthService {
  constructor(private readonly prisma: PrismaService) {}
  private async limit() {
    // Separate persistent bucket: no caller-controlled IP or per-token rows.
    const rows = await this.prisma.$queryRaw<{ hits: number }[]>`
      INSERT INTO "AuthAttempt" ("id", "hits", "windowStart") VALUES ('mobile-refresh', 1, NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "hits" = CASE WHEN "AuthAttempt"."windowStart" <= NOW() - INTERVAL '1 minute'
          THEN 1 ELSE LEAST("AuthAttempt"."hits" + 1, 1000000) END,
        "windowStart" = CASE WHEN "AuthAttempt"."windowStart" <= NOW() - INTERVAL '1 minute'
          THEN NOW() ELSE "AuthAttempt"."windowStart" END RETURNING "hits"`;
    if (rows[0].hits > 60) throw new HttpException('Too many attempts. Retry later.', 429);
  }
  private async ownerLock(tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT "id" FROM "Owner" WHERE "id" = 1 FOR UPDATE`;
  }
  private async issue(tx: Prisma.TransactionClient, deviceId: string, deviceExpiry: Date) {
    const token = randomToken(), refreshToken = randomToken();
    const expiresAt = new Date(Math.min(Date.now() + MOBILE_ACCESS_MS, deviceExpiry.getTime()));
    await tx.ownerSession.deleteMany({ where: { deviceId } });
    await tx.ownerSession.create({ data: { tokenHash: hashToken(token), deviceId, expiresAt } });
    await tx.mobileRefresh.create({ data: { tokenHash: hashToken(refreshToken), deviceId } });
    return { token, refreshToken, expiresAt: expiresAt.toISOString() };
  }
  async enroll(ownerToken: string, name: string) {
    return this.prisma.$transaction(async tx => {
      await this.ownerLock(tx);
      const session = await tx.ownerSession.findUnique({ where: { tokenHash: hashToken(ownerToken) } });
      const now = new Date();
      if (!session || session.deviceId || session.expiresAt <= now ||
          now.getTime() - session.createdAt.getTime() > 2 * 60_000) {
        throw new UnauthorizedException('Sign in again before connecting a device.');
      }
      await tx.mobileDevice.deleteMany({ where: { OR: [
        { expiresAt: { lte: now } }, { lastUsedAt: { lte: new Date(now.getTime() - MOBILE_IDLE_MS) } },
      ] } });
      if (await tx.mobileDevice.count() >= 5) throw new HttpException('Remove an old device in WEB before connecting another.', 409);
      const device = await tx.mobileDevice.create({ data: { name, expiresAt: new Date(now.getTime() + MOBILE_TRUST_MS) } });
      const result = await this.issue(tx, device.id, device.expiresAt);
      // Enrollment consumes the short-lived full-authentication handoff session.
      await tx.ownerSession.delete({ where: { tokenHash: session.tokenHash } });
      return result;
    });
  }
  async refresh(refreshToken: string) {
    await this.limit();
    const result = await this.prisma.$transaction(async tx => {
      await this.ownerLock(tx); // Serializes refresh, revocation, recovery and operator reset.
      const credential = await tx.mobileRefresh.findUnique({ where: { tokenHash: hashToken(refreshToken) }, include: { device: true } });
      if (!credential) return null;
      const now = new Date(), device = credential.device;
      if (credential.usedAt || device.expiresAt <= now || now.getTime() - device.lastUsedAt.getTime() >= MOBILE_IDLE_MS) {
        // Commit revocation before rejecting; throwing inside this transaction would undo it.
        await tx.mobileDevice.delete({ where: { id: device.id } });
        return null;
      }
      await tx.mobileRefresh.update({ where: { tokenHash: credential.tokenHash }, data: { usedAt: now } });
      await tx.mobileDevice.update({ where: { id: device.id }, data: { lastUsedAt: now } });
      return this.issue(tx, device.id, device.expiresAt);
    });
    if (!result) throw new UnauthorizedException('Device access expired or was revoked. Sign in again.');
    return result;
  }
  async disconnect(refreshToken: string) {
    await this.limit();
    await this.prisma.$transaction(async tx => {
      await this.ownerLock(tx);
      const credential = await tx.mobileRefresh.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
      if (credential) await tx.mobileDevice.deleteMany({ where: { id: credential.deviceId } });
    });
  }
  private async webOnly(tx: Prisma.TransactionClient, token: string) {
    const session = await tx.ownerSession.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!session || session.expiresAt <= new Date() || session.deviceId) throw new ForbiddenException('Use the WEB owner account to manage devices.');
  }
  async list(token: string) {
    return this.prisma.$transaction(async tx => {
      await this.ownerLock(tx);
      await this.webOnly(tx, token);
      return tx.mobileDevice.findMany({ orderBy: { createdAt: 'desc' }, select: {
        id: true, name: true, createdAt: true, lastUsedAt: true, expiresAt: true,
      } });
    });
  }
  async revoke(token: string, id: string) {
    await this.prisma.$transaction(async tx => {
      await this.ownerLock(tx);
      await this.webOnly(tx, token);
      await tx.mobileDevice.deleteMany({ where: { id, ownerId: 1 } });
    });
  }
}
