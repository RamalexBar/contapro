-- Retenciones (2026-11-24): base minima en UVT, tarifa para no declarantes y proveedor declarante.
ALTER TABLE "withholding_concepts" ADD COLUMN "minBaseUvt" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "withholding_concepts" ADD COLUMN "nonDeclarantRatePercent" DECIMAL(5,2);
ALTER TABLE "suppliers" ADD COLUMN "incomeTaxDeclarant" BOOLEAN NOT NULL DEFAULT true;

-- Valores vigentes (Decreto 572 de 2025, vigente de nuevo desde el 1 de julio de 2026) para los
-- conceptos que Contapro siembra por defecto. No se tocan las tarifas que cada empresa ya edito.
UPDATE "withholding_concepts" SET "minBaseUvt" = 10, "nonDeclarantRatePercent" = 3.5 WHERE "code" = 'RF-COMPRAS';
UPDATE "withholding_concepts" SET "minBaseUvt" = 2, "nonDeclarantRatePercent" = 6 WHERE "code" = 'RF-SERVICIOS';
UPDATE "withholding_concepts" SET "minBaseUvt" = 0, "nonDeclarantRatePercent" = 10 WHERE "code" = 'RF-HONORARIOS';
UPDATE "withholding_concepts" SET "minBaseUvt" = 10 WHERE "code" = 'RF-ARRENDAMIENTOS';
UPDATE "withholding_concepts" SET "minBaseUvt" = 10, "name" = 'Retencion de IVA (compras)' WHERE "code" = 'IVA-RETE' AND "name" = 'Retencion de IVA';

-- ReteIVA de servicios: misma tarifa (15 % del IVA) pero desde 2 UVT.
INSERT INTO "withholding_concepts" ("id", "companyId", "code", "name", "type", "ratePercent", "isActive", "createdAt", "minBaseUvt")
SELECT gen_random_uuid()::text, c."id", 'IVA-RETE-SERV', 'Retencion de IVA (servicios)', 'RETEIVA', 15, true, NOW(), 2
FROM "companies" c
ON CONFLICT ("companyId", "code") DO NOTHING;
