-- Repair InventoryTransaction location type columns that were previously stored as TEXT
-- and may contain job/location ids instead of InventoryLocationType enum values.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'InventoryTransaction'
      AND column_name = 'locationFromType'
      AND udt_name <> 'InventoryLocationType'
  ) THEN
    ALTER TABLE "InventoryTransaction"
      ALTER COLUMN "locationFromType" TYPE TEXT
      USING "locationFromType"::text;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'InventoryTransaction'
      AND column_name = 'locationToType'
      AND udt_name <> 'InventoryLocationType'
  ) THEN
    ALTER TABLE "InventoryTransaction"
      ALTER COLUMN "locationToType" TYPE TEXT
      USING "locationToType"::text;
  END IF;
END $$;

UPDATE "InventoryTransaction"
SET
  "locationFromJobId" = COALESCE(
    "locationFromJobId",
    CASE
      WHEN "locationFromType" IS NULL THEN NULL
      WHEN BTRIM("locationFromType") IN ('', 'SHOP', 'JOB') THEN NULL
      WHEN LOWER(BTRIM("locationFromType")) = 'shop' THEN NULL
      WHEN LOWER(BTRIM("locationFromType")) LIKE 'loc-%' THEN SUBSTRING(BTRIM("locationFromType") FROM 5)
      ELSE BTRIM("locationFromType")
    END
  ),
  "locationFromType" = CASE
    WHEN "locationFromType" IS NULL OR BTRIM("locationFromType") = '' THEN NULL
    WHEN UPPER(BTRIM("locationFromType")) = 'SHOP' THEN 'SHOP'
    ELSE 'JOB'
  END,
  "locationToJobId" = COALESCE(
    "locationToJobId",
    CASE
      WHEN "locationToType" IS NULL THEN NULL
      WHEN BTRIM("locationToType") IN ('', 'SHOP', 'JOB') THEN NULL
      WHEN LOWER(BTRIM("locationToType")) = 'shop' THEN NULL
      WHEN LOWER(BTRIM("locationToType")) LIKE 'loc-%' THEN SUBSTRING(BTRIM("locationToType") FROM 5)
      ELSE BTRIM("locationToType")
    END
  ),
  "locationToType" = CASE
    WHEN "locationToType" IS NULL OR BTRIM("locationToType") = '' THEN NULL
    WHEN UPPER(BTRIM("locationToType")) = 'SHOP' THEN 'SHOP'
    ELSE 'JOB'
  END
WHERE
  ("locationFromType" IS NOT NULL AND UPPER(BTRIM("locationFromType")) NOT IN ('SHOP', 'JOB'))
  OR ("locationToType" IS NOT NULL AND UPPER(BTRIM("locationToType")) NOT IN ('SHOP', 'JOB'))
  OR ("locationFromType" = 'SHOP' AND "locationFromJobId" IS NOT NULL)
  OR ("locationToType" = 'SHOP' AND "locationToJobId" IS NOT NULL)
  OR ("locationFromType" = 'JOB' AND "locationFromJobId" IS NULL)
  OR ("locationToType" = 'JOB' AND "locationToJobId" IS NULL);

UPDATE "InventoryTransaction"
SET "locationFromJobId" = NULL
WHERE "locationFromType" IS DISTINCT FROM 'JOB';

UPDATE "InventoryTransaction"
SET "locationToJobId" = NULL
WHERE "locationToType" IS DISTINCT FROM 'JOB';

ALTER TABLE "InventoryTransaction"
  ALTER COLUMN "locationFromType" TYPE "InventoryLocationType"
  USING CASE
    WHEN "locationFromType" IS NULL THEN NULL
    ELSE UPPER(BTRIM("locationFromType"))::"InventoryLocationType"
  END,
  ALTER COLUMN "locationToType" TYPE "InventoryLocationType"
  USING CASE
    WHEN "locationToType" IS NULL THEN NULL
    ELSE UPPER(BTRIM("locationToType"))::"InventoryLocationType"
  END;
