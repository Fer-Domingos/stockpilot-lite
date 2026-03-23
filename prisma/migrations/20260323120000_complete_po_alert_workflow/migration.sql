DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PurchaseOrderAlertStatus') THEN
    CREATE TYPE "PurchaseOrderAlertStatus" AS ENUM ('OPEN', 'TRIGGERED', 'SEEN', 'RESOLVED');
  END IF;
END $$;

ALTER TABLE "ExpectedPurchaseOrder"
  ADD COLUMN IF NOT EXISTS "status" "PurchaseOrderAlertStatus" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN IF NOT EXISTS "lastTriggeredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "seenAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "triggerCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "PurchaseOrderAlert"
  ADD COLUMN IF NOT EXISTS "status" "PurchaseOrderAlertStatus" NOT NULL DEFAULT 'TRIGGERED',
  ADD COLUMN IF NOT EXISTS "seenAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "triggerCount" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "ExpectedPurchaseOrder"
SET "status" = 'TRIGGERED',
    "lastTriggeredAt" = COALESCE("lastTriggeredAt", "updatedAt"),
    "triggerCount" = GREATEST("triggerCount", 1)
WHERE EXISTS (
  SELECT 1 FROM "PurchaseOrderAlert" WHERE "PurchaseOrderAlert"."expectedPoId" = "ExpectedPurchaseOrder"."id"
);

UPDATE "PurchaseOrderAlert"
SET "updatedAt" = COALESCE("updatedAt", "createdAt");
