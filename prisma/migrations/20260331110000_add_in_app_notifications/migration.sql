-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PO_ALERT_DONE');

-- CreateTable
CREATE TABLE "InAppNotification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "expectedPoId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InAppNotification_recipientId_isRead_createdAt_idx" ON "InAppNotification"("recipientId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "InAppNotification_expectedPoId_idx" ON "InAppNotification"("expectedPoId");

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_expectedPoId_fkey" FOREIGN KEY ("expectedPoId") REFERENCES "ExpectedPurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
