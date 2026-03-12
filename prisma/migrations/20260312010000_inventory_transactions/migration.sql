-- Add current on-hand quantity to materials
ALTER TABLE "Material"
ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 0;

-- Replace transaction type enum to support transfer workflow
CREATE TYPE "InventoryTransactionType" AS ENUM ('RECEIVE', 'TRANSFER');

ALTER TABLE "InventoryTransaction"
DROP CONSTRAINT "InventoryTransaction_userId_fkey",
DROP CONSTRAINT "InventoryTransaction_locationId_fkey";

ALTER TABLE "InventoryTransaction"
ADD COLUMN "jobId" TEXT,
ADD COLUMN "locationFrom" TEXT,
ADD COLUMN "locationTo" TEXT;

ALTER TABLE "InventoryTransaction"
ALTER COLUMN "type" TYPE "InventoryTransactionType"
USING (
  CASE
    WHEN "type"::text = 'RECEIVE' THEN 'RECEIVE'::"InventoryTransactionType"
    ELSE 'TRANSFER'::"InventoryTransactionType"
  END
);

ALTER TABLE "InventoryTransaction"
DROP COLUMN "userId",
DROP COLUMN "locationId",
DROP COLUMN "notes";

DROP TYPE "TransactionType";

-- Add relation to job usage (optional)
ALTER TABLE "InventoryTransaction"
ADD CONSTRAINT "InventoryTransaction_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "InventoryTransaction_jobId_createdAt_idx" ON "InventoryTransaction"("jobId", "createdAt");

-- Remove obsolete tables from legacy demo schema
DROP TABLE "User";
DROP TABLE "Location";
