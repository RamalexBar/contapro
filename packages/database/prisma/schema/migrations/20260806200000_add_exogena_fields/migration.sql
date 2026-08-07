-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "documentType" TEXT NOT NULL DEFAULT 'NIT',
ADD COLUMN     "municipalityCode" TEXT;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "municipalityCode" TEXT;

-- AlterTable
ALTER TABLE "withholding_concepts" ADD COLUMN     "dianConceptCode" TEXT;
