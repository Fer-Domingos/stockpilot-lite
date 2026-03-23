ALTER TABLE "InventoryTransaction"
ADD COLUMN IF NOT EXISTS "reversedByUserId" TEXT,
ADD COLUMN IF NOT EXISTS "reversedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "InventoryTransaction_reversedByUserId_createdAt_idx"
ON "InventoryTransaction"("reversedByUserId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'InventoryTransaction_reversedByUserId_fkey'
  ) THEN
    ALTER TABLE "InventoryTransaction"
    ADD CONSTRAINT "InventoryTransaction_reversedByUserId_fkey"
    FOREIGN KEY ("reversedByUserId") REFERENCES "AdminUser"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
