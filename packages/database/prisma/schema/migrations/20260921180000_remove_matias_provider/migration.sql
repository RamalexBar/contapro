-- Seguridad: si alguna empresa quedo configurada con MATIAS, la vuelve a DIRECT antes de eliminar
-- el valor del enum (Postgres no permite borrar un valor de enum todavia en uso por una columna).
UPDATE "companies" SET "electronicInvoicingProvider" = 'DIRECT' WHERE "electronicInvoicingProvider" = 'MATIAS';

-- Ya no hace falta: MATIAS se elimino del sistema (decision del usuario, 2026-09-21).
ALTER TABLE "companies" DROP COLUMN "matiasApiTokenEncrypted";

-- Postgres no soporta "ALTER TYPE ... DROP VALUE" -- se recrea el enum sin MATIAS.
ALTER TYPE "DianProviderType" RENAME TO "DianProviderType_old";
CREATE TYPE "DianProviderType" AS ENUM ('DIRECT', 'FACTUS');
ALTER TABLE "companies" ALTER COLUMN "electronicInvoicingProvider" DROP DEFAULT;
ALTER TABLE "companies" ALTER COLUMN "electronicInvoicingProvider" TYPE "DianProviderType" USING ("electronicInvoicingProvider"::text::"DianProviderType");
ALTER TABLE "companies" ALTER COLUMN "electronicInvoicingProvider" SET DEFAULT 'DIRECT';
DROP TYPE "DianProviderType_old";
