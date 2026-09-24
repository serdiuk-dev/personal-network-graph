-- Add the three relationship-distance circles used by the radial graph.
-- Existing people receive MIDDLE as the neutral default.

CREATE TYPE "NetworkCircle" AS ENUM (
  'INNER',
  'MIDDLE',
  'OUTER'
);

ALTER TABLE "Person"
ADD COLUMN "networkCircle" "NetworkCircle"
NOT NULL DEFAULT 'MIDDLE';
