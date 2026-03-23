ALTER TABLE "ExpectedPurchaseOrder"
ADD COLUMN "ownerId" TEXT;

ALTER TABLE "PurchaseOrderAlert"
ADD COLUMN "ownerId" TEXT;

CREATE INDEX "ExpectedPurchaseOrder_ownerId_idx" ON "ExpectedPurchaseOrder"("ownerId");
CREATE INDEX "PurchaseOrderAlert_ownerId_idx" ON "PurchaseOrderAlert"("ownerId");

ALTER TABLE "ExpectedPurchaseOrder"
ADD CONSTRAINT "ExpectedPurchaseOrder_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderAlert"
ADD CONSTRAINT "PurchaseOrderAlert_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "PurchaseOrderAlert" AS alert
SET "ownerId" = tracked."ownerId"
FROM "ExpectedPurchaseOrder" AS tracked
WHERE tracked."id" = alert."expectedPoId"
  AND alert."ownerId" IS NULL;
