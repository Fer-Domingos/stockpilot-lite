-- CreateTable
CREATE TABLE "ExpectedPurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "normalizedPoNumber" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "jobId" TEXT,

    CONSTRAINT "ExpectedPurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderAlert" (
    "id" TEXT NOT NULL,
    "expectedPoId" TEXT NOT NULL,
    "receivingRecordId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrderAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpectedPurchaseOrder_normalizedPoNumber_key" ON "ExpectedPurchaseOrder"("normalizedPoNumber");

-- CreateIndex
CREATE INDEX "ExpectedPurchaseOrder_jobId_idx" ON "ExpectedPurchaseOrder"("jobId");

-- CreateIndex
CREATE INDEX "ExpectedPurchaseOrder_poNumber_idx" ON "ExpectedPurchaseOrder"("poNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderAlert_expectedPoId_receivingRecordId_key" ON "PurchaseOrderAlert"("expectedPoId", "receivingRecordId");

-- CreateIndex
CREATE INDEX "PurchaseOrderAlert_createdAt_idx" ON "PurchaseOrderAlert"("createdAt");

-- AddForeignKey
ALTER TABLE "ExpectedPurchaseOrder" ADD CONSTRAINT "ExpectedPurchaseOrder_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderAlert" ADD CONSTRAINT "PurchaseOrderAlert_expectedPoId_fkey" FOREIGN KEY ("expectedPoId") REFERENCES "ExpectedPurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderAlert" ADD CONSTRAINT "PurchaseOrderAlert_receivingRecordId_fkey" FOREIGN KEY ("receivingRecordId") REFERENCES "ReceivingRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
