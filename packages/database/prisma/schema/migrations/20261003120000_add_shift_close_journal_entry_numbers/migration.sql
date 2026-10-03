-- AlterTable
ALTER TABLE "external_shift_closes" ADD COLUMN "journalEntryNumbers" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
