-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PM');

-- AlterTable
ALTER TABLE "AdminUser"
ADD COLUMN     "name" TEXT NOT NULL DEFAULT 'Admin User',
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'ADMIN';
