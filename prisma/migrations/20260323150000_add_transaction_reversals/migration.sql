ALTER TABLE "InventoryTransaction"
ADD COLUMN "reversedTransactionId" TEXT,
ADD COLUMN "reversalReason" TEXT;

ALTER TABLE "InventoryTransaction"
ADD CONSTRAINT "InventoryTransaction_reversedTransactionId_fkey"
FOREIGN KEY ("reversedTransactionId") REFERENCES "InventoryTransaction"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "InventoryTransaction_reversedTransactionId_key"
ON "InventoryTransaction"("reversedTransactionId");
