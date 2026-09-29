import { HttpException, Injectable, OnModuleInit, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { csrfFor, hashPassword, hashToken, IDLE_MS, MAX_MS, publicOrigin, randomToken, readKey, same, unseal, validStep, verifyPassword } from './crypto';

@Injectable()
export class AuthService implements OnModuleInit {
  readonly origin = publicOrigin();
  private readonly key = readKey();
  private dummyHash = '';
  private inFlight = 0;
  constructor(private readonly prisma: PrismaService) {}
  async onModuleInit() { this.dummyHash = await hashPassword(randomToken()); }
  csrf(token: string) { return csrfFor(token, this.key); }

  private async consumeAttempt() {
    // Two fixed global buckets: single-owner deployment. No spoofable XFF identity.
    const allowed = await this.prisma.$transaction(async tx => {
      let result = true;
      for (const [id, seconds, limit] of [['minute', 60, 10], ['quarter', 900, 30]] as const) {
        const rows = await tx.$queryRaw<{ hits: number }[]>`
          INSERT INTO "AuthAttempt" ("id", "hits", "windowStart")
          VALUES (${id}, 1, NOW())
          ON CONFLICT ("id") DO UPDATE SET
            "hits" = CASE WHEN "AuthAttempt"."windowStart" <= NOW() - (${seconds} * INTERVAL '1 second')
              THEN 1 ELSE LEAST("AuthAttempt"."hits" + 1, 1000000) END,
            "windowStart" = CASE WHEN "AuthAttempt"."windowStart" <= NOW() - (${seconds} * INTERVAL '1 second')
              THEN NOW() ELSE "AuthAttempt"."windowStart" END
          RETURNING "hits"`;
        if (rows[0].hits > limit) result = false;
      }
      return result;
    });
    if (!allowed) throw new HttpException('Too many login attempts. Try again later.', 429);
  }

  async login(login: string, password: string, code: string) {
    await this.consumeAttempt();
    if (this.inFlight >= 2) throw new ServiceUnavailableException('Authentication busy. Try again later.');
    this.inFlight++;
    try {
      const candidate = await this.prisma.owner.findUnique({ where: { id: 1 } });
      const matchesLogin = candidate !== null && same(candidate.login, login);
      const validPassword = await verifyPassword(matchesLogin ? candidate!.passwordHash : this.dummyHash, password);
      if (!candidate || !matchesLogin || !validPassword) throw new UnauthorizedException('Invalid credentials');
      const token = randomToken();
      await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "Owner" WHERE "id" = 1 FOR UPDATE`;
        const owner = await tx.owner.findUnique({ where: { id: 1 } });
        if (!owner || owner.version !== candidate.version) throw new UnauthorizedException('Invalid credentials');
        const step = validStep(unseal(owner.totpEncrypted, this.key), code);
        const recovery = /^[a-f0-9]{32}$/.test(code) ? hashToken(code) : '';
        const recoveryIndex = recovery ? owner.recoveryHashes.findIndex(value => same(value, recovery)) : -1;
        if (recoveryIndex >= 0) {
          await tx.owner.update({ where: { id: 1 }, data: { recoveryHashes: owner.recoveryHashes.filter((_, index) => index !== recoveryIndex) } });
          // Lost-factor recovery invalidates any previously issued sessions.
          await tx.ownerSession.deleteMany({ where: { ownerId: 1 } });
        } else if (step !== null && step > owner.lastTotpStep) {
          await tx.owner.update({ where: { id: 1 }, data: { lastTotpStep: step } });
        } else throw new UnauthorizedException('Invalid credentials');
        const now = new Date();
        await tx.ownerSession.deleteMany({ where: { OR: [ { expiresAt: { lte: now } }, { lastSeenAt: { lte: new Date(now.getTime() - IDLE_MS) } } ] } });
        // Bound stored sessions for this single-owner application.
        const older = await tx.ownerSession.findMany({ orderBy: { createdAt: 'desc' }, skip: 4, select: { tokenHash: true } });
        if (older.length) await tx.ownerSession.deleteMany({ where: { tokenHash: { in: older.map(item => item.tokenHash) } } });
        await tx.ownerSession.create({ data: { tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + MAX_MS), lastSeenAt: now } });
      });
      return { token, csrf: this.csrf(token) };
    } finally { this.inFlight--; }
  }

  async authenticate(token: string) {
    const now = new Date();
    const result = await this.prisma.ownerSession.updateMany({
      where: { tokenHash: hashToken(token), expiresAt: { gt: now }, lastSeenAt: { gt: new Date(now.getTime() - IDLE_MS) } },
      data: { lastSeenAt: now },
    });
    if (result.count !== 1) throw new UnauthorizedException('Authentication required');
  }
  async logout(token: string) { await this.prisma.ownerSession.deleteMany({ where: { tokenHash: hashToken(token) } }); }
}
