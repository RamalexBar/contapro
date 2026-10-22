-- Datos del negocio para el tiquete y los comprobantes: actividad economica (CIIU), contacto y
-- textos del tiquete. El logo usa la columna "logoUrl" ya existente (data URL guardado en la BD).
ALTER TABLE "companies" ADD COLUMN "economicActivity" TEXT;
ALTER TABLE "companies" ADD COLUMN "whatsapp" TEXT;
ALTER TABLE "companies" ADD COLUMN "website" TEXT;
ALTER TABLE "companies" ADD COLUMN "instagram" TEXT;
ALTER TABLE "companies" ADD COLUMN "receiptHeader" TEXT;
ALTER TABLE "companies" ADD COLUMN "receiptFooter" TEXT;
