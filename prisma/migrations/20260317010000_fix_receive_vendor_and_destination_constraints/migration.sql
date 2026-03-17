-- Align vendor column naming used by Prisma schema and app code.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ReceivingRecord' AND column_name = 'vendorName'
  ) THEN
    ALTER TABLE "ReceivingRecord" RENAME COLUMN "vendorName" TO "vendor";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'InventoryTransaction' AND column_name = 'vendorName'
  ) THEN
    ALTER TABLE "InventoryTransaction" RENAME COLUMN "vendorName" TO "vendor";
  END IF;
END $$;

-- Enforce destination/job consistency for receipt writes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ReceivingRecord_destination_job_consistency'
  ) THEN
    ALTER TABLE "ReceivingRecord"
    ADD CONSTRAINT "ReceivingRecord_destination_job_consistency"
    CHECK (
      ("destinationType" = 'SHOP' AND "jobId" IS NULL)
      OR
      ("destinationType" = 'JOB' AND "jobId" IS NOT NULL)
    );
  END IF;
END $$;
