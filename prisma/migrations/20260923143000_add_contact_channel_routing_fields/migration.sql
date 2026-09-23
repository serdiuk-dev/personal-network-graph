-- AlterTable
ALTER TABLE "ContactChannel"
ADD COLUMN "externalId" TEXT,
ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN "automationAllowed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ContactChannel_personId_priority_idx"
ON "ContactChannel"("personId", "priority");

-- CreateIndex
CREATE INDEX "ContactChannel_platform_externalId_idx"
ON "ContactChannel"("platform", "externalId");
