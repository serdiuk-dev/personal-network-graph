CREATE TABLE "Owner" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "login" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "totpEncrypted" TEXT NOT NULL,
  "lastTotpStep" BIGINT NOT NULL DEFAULT -1,
  "version" TEXT NOT NULL,
  "recoveryHashes" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Owner_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Owner_singleton" CHECK ("id" = 1)
);
CREATE UNIQUE INDEX "Owner_login_key" ON "Owner"("login");
CREATE TABLE "OwnerSession" (
  "tokenHash" TEXT NOT NULL,
  "ownerId" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OwnerSession_pkey" PRIMARY KEY ("tokenHash"),
  CONSTRAINT "OwnerSession_ownerId_fkey" FOREIGN KEY ("ownerId")
    REFERENCES "Owner"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "OwnerSession_expiresAt_idx" ON "OwnerSession"("expiresAt");
CREATE TABLE "AuthAttempt" (
  "id" TEXT NOT NULL,
  "hits" INTEGER NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthAttempt_pkey" PRIMARY KEY ("id")
);
