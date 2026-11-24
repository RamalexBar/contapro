-- Documento del beneficiario del gasto, para la exogena 1001 (2026-11-24).
ALTER TABLE "expenses" ADD COLUMN "payeeDocumentType" TEXT;
ALTER TABLE "expenses" ADD COLUMN "payeeDocumentNumber" TEXT;
