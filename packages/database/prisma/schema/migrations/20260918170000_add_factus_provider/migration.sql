-- AlterEnum
ALTER TYPE "DianProviderType" ADD VALUE 'FACTUS';

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "factusCredentialsEncrypted" TEXT;
