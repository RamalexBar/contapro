-- CreateEnum
CREATE TYPE "DianProviderType" AS ENUM ('DIRECT', 'MATIAS');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "electronicInvoicingProvider" "DianProviderType" NOT NULL DEFAULT 'DIRECT',
ADD COLUMN     "matiasApiTokenEncrypted" TEXT;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "dianIdentityDocumentId" TEXT,
ADD COLUMN     "dianTypeOrganizationId" TEXT,
ADD COLUMN     "dianTaxRegimeId" TEXT,
ADD COLUMN     "dianTaxLevelId" TEXT,
ADD COLUMN     "dianCountryId" TEXT,
ADD COLUMN     "dianCityId" TEXT,
ADD COLUMN     "dianPostalCode" TEXT;
