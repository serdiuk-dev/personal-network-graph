-- Add persistent per-relationship visual overrides.
-- Both fields are nullable so existing relationships keep
-- the application-level Prodigy defaults.

ALTER TABLE "Relationship"
ADD COLUMN "visualColor" TEXT,
ADD COLUMN "visualWidth" DOUBLE PRECISION;
