-- PEPS para todos los productos (2026-11-10). Ver modules/inventory/stock/README.md, "Costeo PEPS".

-- 1. Costo real por linea de venta. Se rellena ANTES de cambiar costMethod para poder distinguir las ventas que ya se
--    costearon por lotes reales (FIFO + tracksBatches: sus SALE_OUT tienen batchId y el costo del lote) de las demas,
--    que se estiman con el costo actual del producto (mismo criterio que usaba el asiento de costo de venta).
ALTER TABLE "sale_items" ADD COLUMN "costTotal" DECIMAL(14,2);

UPDATE "sale_items" si
SET "costTotal" = ROUND(si."quantity" * COALESCE(
  (SELECT SUM(m."quantity" * m."unitCost") / NULLIF(SUM(m."quantity"), 0)
     FROM "stock_movements" m
    WHERE m."type" = 'SALE_OUT' AND m."referenceType" = 'Sale' AND m."referenceId" = si."saleId"
      AND m."productId" = si."productId" AND m."batchId" IS NOT NULL),
  p."currentCost"), 2)
FROM "sales" s, "products" p
WHERE s."id" = si."saleId" AND p."id" = si."productId"
  AND s."status" IN ('COMPLETED', 'RETURNED_PARTIAL', 'RETURNED_FULL');

-- 2. PEPS por defecto y para todos los productos existentes.
ALTER TABLE "products" ALTER COLUMN "costMethod" SET DEFAULT 'FIFO';
UPDATE "products" SET "costMethod" = 'FIFO';

-- 3. Capa de saldo inicial: las existencias que hoy no estan cubiertas por ningun lote (todo producto que no manejaba
--    lotes) quedan como una capa valorizada al costo actual del producto, la mas vieja de su sucursal, para que la
--    primera venta despues de este cambio consuma primero ese saldo y despues las compras nuevas.
INSERT INTO "batches" ("id", "companyId", "productId", "branchId", "batchNumber", "quantity", "costAtEntry", "createdAt")
SELECT gen_random_uuid()::text, pbs."companyId", pbs."productId", pbs."branchId", 'SALDO-INICIAL',
       pbs."quantity" - COALESCE(b.qty, 0), p."currentCost",
       LEAST(p."createdAt", COALESCE(b.first_at, p."createdAt")) - INTERVAL '1 second'
FROM "product_branch_stocks" pbs
JOIN "products" p ON p."id" = pbs."productId"
LEFT JOIN (
  SELECT "productId", "branchId", SUM("quantity") AS qty, MIN("createdAt") AS first_at
  FROM "batches" WHERE "quantity" > 0 GROUP BY "productId", "branchId"
) b ON b."productId" = pbs."productId" AND b."branchId" = pbs."branchId"
WHERE pbs."quantity" > COALESCE(b.qty, 0);
