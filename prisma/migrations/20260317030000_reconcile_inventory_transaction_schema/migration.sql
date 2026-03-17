-- Reconcile InventoryTransaction columns/enums with current Prisma schema.

-- Ensure InventoryTransactionType enum exists and includes all values used by the app.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'InventoryTransactionType'
  ) THEN
    CREATE TYPE "InventoryTransactionType" AS ENUM ('RECEIVE', 'TRANSFER', 'ISSUE', 'ADJUSTMENT');
  END IF;
END $$;

ALTER TYPE "InventoryTransactionType" ADD VALUE IF NOT EXISTS 'ISSUE';
ALTER TYPE "InventoryTransactionType" ADD VALUE IF NOT EXISTS 'ADJUSTMENT';

-- Ensure InventoryLocationType enum exists for normalized location columns.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'InventoryLocationType'
  ) THEN
    CREATE TYPE "InventoryLocationType" AS ENUM ('SHOP', 'JOB');
  END IF;
END $$;

-- Rename legacy InventoryTransaction columns when present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'InventoryTransaction' AND column_name = 'type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'InventoryTransaction' AND column_name = 'transactionType'
  ) THEN
    ALTER TABLE "InventoryTransaction" RENAME COLUMN "type" TO "transactionType";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'InventoryTransaction' AND column_name = 'locationFrom'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'InventoryTransaction' AND column_name = 'locationFromType'
  ) THEN
    ALTER TABLE "InventoryTransaction" RENAME COLUMN "locationFrom" TO "locationFromType";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'InventoryTransaction' AND column_name = 'locationTo'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'InventoryTransaction' AND column_name = 'locationToType'
  ) THEN
    ALTER TABLE "InventoryTransaction" RENAME COLUMN "locationTo" TO "locationToType";
  END IF;
END $$;

-- Add missing InventoryTransaction columns required by current app code.
ALTER TABLE "InventoryTransaction"
  ADD COLUMN IF NOT EXISTS "transactionType" "InventoryTransactionType",
  ADD COLUMN IF NOT EXISTS "locationFromType" "InventoryLocationType",
  ADD COLUMN IF NOT EXISTS "locationFromJobId" TEXT,
  ADD COLUMN IF NOT EXISTS "locationToType" "InventoryLocationType",
  ADD COLUMN IF NOT EXISTS "locationToJobId" TEXT,
  ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "vendor" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;

-- Backfill destination job from legacy jobId column if needed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'InventoryTransaction' AND column_name = 'jobId'
  ) THEN
    EXECUTE '
      UPDATE "InventoryTransaction"
      SET "locationToJobId" = COALESCE("locationToJobId", "jobId")
      WHERE "jobId" IS NOT NULL
    ';
  END IF;
END $$;

-- Keep legacy transaction type values readable by the current enum definition.
UPDATE "InventoryTransaction"
SET "transactionType" = 'RECEIVE'
WHERE "transactionType" IS NULL;

-- Ensure transactionType is required moving forward.
ALTER TABLE "InventoryTransaction"
  ALTER COLUMN "transactionType" SET NOT NULL;

-- Ensure receiving relation uniqueness/indexes and query indexes exist.
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryTransaction_receivingRecordId_key"
  ON "InventoryTransaction"("receivingRecordId");

CREATE INDEX IF NOT EXISTS "InventoryTransaction_materialId_createdAt_idx"
  ON "InventoryTransaction"("materialId", "createdAt");

CREATE INDEX IF NOT EXISTS "InventoryTransaction_locationFromJobId_createdAt_idx"
  ON "InventoryTransaction"("locationFromJobId", "createdAt");

CREATE INDEX IF NOT EXISTS "InventoryTransaction_locationToJobId_createdAt_idx"
  ON "InventoryTransaction"("locationToJobId", "createdAt");

-- Ensure required foreign keys are present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InventoryTransaction_locationFromJobId_fkey'
  ) THEN
    ALTER TABLE "InventoryTransaction"
      ADD CONSTRAINT "InventoryTransaction_locationFromJobId_fkey"
      FOREIGN KEY ("locationFromJobId") REFERENCES "Job"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InventoryTransaction_locationToJobId_fkey'
  ) THEN
    ALTER TABLE "InventoryTransaction"
      ADD CONSTRAINT "InventoryTransaction_locationToJobId_fkey"
      FOREIGN KEY ("locationToJobId") REFERENCES "Job"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Ensure InventoryBalance table exists for inventory page and receive material writes.
CREATE TABLE IF NOT EXISTS "InventoryBalance" (
  "id" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "locationType" "InventoryLocationType" NOT NULL,
  "jobId" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryBalance_materialId_locationType_jobId_key"
  ON "InventoryBalance"("materialId", "locationType", "jobId");

CREATE INDEX IF NOT EXISTS "InventoryBalance_locationType_jobId_idx"
  ON "InventoryBalance"("locationType", "jobId");
