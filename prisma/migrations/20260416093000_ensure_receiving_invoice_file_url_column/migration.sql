-- Ensure optional invoice file URL exists for receive-material writes.
ALTER TABLE "ReceivingRecord"
ADD COLUMN IF NOT EXISTS "invoiceFileUrl" TEXT;
