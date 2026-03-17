-- Create InventoryLocationType enum if it is missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'InventoryLocationType'
  ) THEN
    CREATE TYPE "InventoryLocationType" AS ENUM ('SHOP', 'JOB');
  END IF;
END $$;

-- Create InventoryBalance table if it does not already exist.
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

-- Ensure required indexes exist.
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryBalance_materialId_locationType_jobId_key"
  ON "InventoryBalance"("materialId", "locationType", "jobId");

CREATE INDEX IF NOT EXISTS "InventoryBalance_locationType_jobId_idx"
  ON "InventoryBalance"("locationType", "jobId");

-- Ensure required foreign keys exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'InventoryBalance_materialId_fkey'
  ) THEN
    ALTER TABLE "InventoryBalance"
      ADD CONSTRAINT "InventoryBalance_materialId_fkey"
      FOREIGN KEY ("materialId") REFERENCES "Material"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'InventoryBalance_jobId_fkey'
  ) THEN
    ALTER TABLE "InventoryBalance"
      ADD CONSTRAINT "InventoryBalance_jobId_fkey"
      FOREIGN KEY ("jobId") REFERENCES "Job"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill job balances from legacy JobMaterialStock if that table still exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'JobMaterialStock'
  ) THEN
    INSERT INTO "InventoryBalance" (
      "id",
      "materialId",
      "locationType",
      "jobId",
      "quantity",
      "createdAt",
      "updatedAt"
    )
    SELECT
      CONCAT('ib_', jms."id"),
      jms."materialId",
      'JOB'::"InventoryLocationType",
      jms."jobId",
      jms."quantity",
      jms."createdAt",
      CURRENT_TIMESTAMP
    FROM "JobMaterialStock" jms
    ON CONFLICT ("materialId", "locationType", "jobId")
    DO UPDATE SET
      "quantity" = EXCLUDED."quantity",
      "updatedAt" = CURRENT_TIMESTAMP;
  END IF;
END $$;

-- Backfill shop balances from Material.quantity minus allocated job stock.
WITH allocated AS (
  SELECT
    "materialId",
    COALESCE(SUM("quantity"), 0) AS allocated_quantity
  FROM "InventoryBalance"
  WHERE "locationType" = 'JOB'
  GROUP BY "materialId"
),
shop_rows AS (
  SELECT
    m."id" AS material_id,
    GREATEST(m."quantity" - COALESCE(a.allocated_quantity, 0), 0) AS shop_quantity
  FROM "Material" m
  LEFT JOIN allocated a ON a."materialId" = m."id"
)
INSERT INTO "InventoryBalance" (
  "id",
  "materialId",
  "locationType",
  "jobId",
  "quantity",
  "createdAt",
  "updatedAt"
)
SELECT
  CONCAT('ib_shop_', material_id),
  material_id,
  'SHOP'::"InventoryLocationType",
  NULL,
  shop_quantity,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM shop_rows
WHERE shop_quantity > 0
ON CONFLICT ("materialId", "locationType", "jobId")
DO UPDATE SET
  "quantity" = EXCLUDED."quantity",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Keep Material.quantity synchronized with InventoryBalance totals.
WITH balance_totals AS (
  SELECT
    "materialId",
    COALESCE(SUM("quantity"), 0) AS total_quantity
  FROM "InventoryBalance"
  GROUP BY "materialId"
)
UPDATE "Material" m
SET
  "quantity" = COALESCE(bt.total_quantity, 0),
  "updatedAt" = CURRENT_TIMESTAMP
FROM balance_totals bt
WHERE bt."materialId" = m."id";

UPDATE "Material"
SET
  "quantity" = 0,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" NOT IN (SELECT "materialId" FROM "InventoryBalance")
  AND "quantity" <> 0;
