-- CreateEnum
CREATE TYPE "ContactPlatform" AS ENUM (
    'TELEGRAM',
    'LINKEDIN',
    'INSTAGRAM',
    'FACEBOOK',
    'MESSENGER',
    'EMAIL',
    'WHATSAPP',
    'SIGNAL',
    'VIBER',
    'PHONE',
    'OTHER'
);

-- CreateTable
CREATE TABLE "ContactChannel" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "platform" "ContactPlatform" NOT NULL,
    "handle" TEXT,
    "address" TEXT,
    "profileUrl" TEXT,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactChannel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactChannel_personId_idx"
ON "ContactChannel"("personId");

-- CreateIndex
CREATE INDEX "ContactChannel_platform_idx"
ON "ContactChannel"("platform");

-- AddForeignKey
ALTER TABLE "ContactChannel"
ADD CONSTRAINT "ContactChannel_personId_fkey"
FOREIGN KEY ("personId")
REFERENCES "Person"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
