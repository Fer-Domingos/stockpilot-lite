ALTER TABLE "InventoryTransaction"
ADD COLUMN "usedFor" TEXT;

CREATE INDEX "InventoryTransaction_transactionType_usedFor_createdAt_idx"
ON "InventoryTransaction"("transactionType", "usedFor", "createdAt");
