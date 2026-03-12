-- Create enums for job status and receiving destination
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "DestinationType" AS ENUM ('SHOP', 'JOB');

-- Normalize existing job statuses into OPEN/CLOSED
ALTER TABLE "Job"
ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Job"
ALTER COLUMN "status" TYPE "JobStatus"
USING (
  CASE
    WHEN UPPER("status") IN ('COMPLETED', 'CLOSED') THEN 'CLOSED'::"JobStatus"
    ELSE 'OPEN'::"JobStatus"
  END
);

ALTER TABLE "Job"
ALTER COLUMN "status" SET DEFAULT 'OPEN';

-- Store per-job material allocations
CREATE TABLE "JobMaterialStock" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobMaterialStock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobMaterialStock_jobId_materialId_key" ON "JobMaterialStock"("jobId", "materialId");
CREATE INDEX "JobMaterialStock_materialId_idx" ON "JobMaterialStock"("materialId");

ALTER TABLE "JobMaterialStock" ADD CONSTRAINT "JobMaterialStock_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobMaterialStock" ADD CONSTRAINT "JobMaterialStock_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add receiving records with invoice/photo metadata
CREATE TABLE "ReceivingRecord" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "destinationType" "DestinationType" NOT NULL,
    "jobId" TEXT,
    "invoiceNumber" TEXT,
    "vendorName" TEXT,
    "notes" TEXT,
    "photoUrl" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceivingRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReceivingRecord_createdAt_idx" ON "ReceivingRecord"("createdAt");
CREATE INDEX "ReceivingRecord_materialId_receivedAt_idx" ON "ReceivingRecord"("materialId", "receivedAt");
CREATE INDEX "ReceivingRecord_jobId_receivedAt_idx" ON "ReceivingRecord"("jobId", "receivedAt");

ALTER TABLE "ReceivingRecord" ADD CONSTRAINT "ReceivingRecord_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceivingRecord" ADD CONSTRAINT "ReceivingRecord_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Link receive transactions to receiving records
ALTER TABLE "InventoryTransaction" ADD COLUMN "receivingRecordId" TEXT;
CREATE UNIQUE INDEX "InventoryTransaction_receivingRecordId_key" ON "InventoryTransaction"("receivingRecordId");
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_receivingRecordId_fkey" FOREIGN KEY ("receivingRecordId") REFERENCES "ReceivingRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
