-- Persistent singleton settings for graph-wide visual styling.

CREATE TABLE "GraphStyleSettings" (
  "id" INTEGER NOT NULL DEFAULT 1,

  "innerRingColor" TEXT NOT NULL DEFAULT '#7dd3fc',
  "innerRingOpacity" DOUBLE PRECISION NOT NULL DEFAULT 0.42,
  "innerRingWidth" DOUBLE PRECISION NOT NULL DEFAULT 1.40,

  "middleRingColor" TEXT NOT NULL DEFAULT '#7dd3fc',
  "middleRingOpacity" DOUBLE PRECISION NOT NULL DEFAULT 0.30,
  "middleRingWidth" DOUBLE PRECISION NOT NULL DEFAULT 1.20,

  "outerRingColor" TEXT NOT NULL DEFAULT '#7dd3fc',
  "outerRingOpacity" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
  "outerRingWidth" DOUBLE PRECISION NOT NULL DEFAULT 1.00,

  "innerEgoColor" TEXT NOT NULL DEFAULT '#9bded9',
  "innerEgoOpacity" DOUBLE PRECISION NOT NULL DEFAULT 0.72,
  "innerEgoWidth" DOUBLE PRECISION NOT NULL DEFAULT 0.85,

  "middleEgoColor" TEXT NOT NULL DEFAULT '#c7e0e8',
  "middleEgoOpacity" DOUBLE PRECISION NOT NULL DEFAULT 0.64,
  "middleEgoWidth" DOUBLE PRECISION NOT NULL DEFAULT 0.60,

  "outerEgoColor" TEXT NOT NULL DEFAULT '#e1ebef',
  "outerEgoOpacity" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
  "outerEgoWidth" DOUBLE PRECISION NOT NULL DEFAULT 0.40,

  "relationshipDefaultColor" TEXT NOT NULL DEFAULT '#bfd6e3',
  "relationshipDefaultOpacity" DOUBLE PRECISION NOT NULL DEFAULT 0.55,
  "relationshipDefaultWidthScale" DOUBLE PRECISION NOT NULL DEFAULT 1.00,

  "relationshipFocusColor" TEXT NOT NULL DEFAULT '#65b7e8',
  "relationshipFocusOpacity" DOUBLE PRECISION NOT NULL DEFAULT 0.92,
  "relationshipFocusWidthScale" DOUBLE PRECISION NOT NULL DEFAULT 1.00,

  "relationshipInactiveColor" TEXT NOT NULL DEFAULT '#e4ecef',
  "relationshipInactiveOpacity" DOUBLE PRECISION NOT NULL DEFAULT 0.65,
  "relationshipInactiveWidth" DOUBLE PRECISION NOT NULL DEFAULT 0.45,

  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GraphStyleSettings_pkey"
    PRIMARY KEY ("id")
);
