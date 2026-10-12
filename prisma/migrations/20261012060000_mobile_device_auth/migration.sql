CREATE TABLE "MobileDevice" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerId" INTEGER NOT NULL DEFAULT 1 REFERENCES "Owner"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "MobileDevice_ownerId_idx" ON "MobileDevice"("ownerId");
CREATE TABLE "MobileRefresh" (
  "tokenHash" TEXT NOT NULL PRIMARY KEY,
  "deviceId" TEXT NOT NULL REFERENCES "MobileDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "usedAt" TIMESTAMP(3)
);
CREATE INDEX "MobileRefresh_deviceId_idx" ON "MobileRefresh"("deviceId");
ALTER TABLE "OwnerSession" ADD COLUMN "deviceId" TEXT;
ALTER TABLE "OwnerSession" ADD CONSTRAINT "OwnerSession_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "MobileDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "OwnerSession_deviceId_idx" ON "OwnerSession"("deviceId");
