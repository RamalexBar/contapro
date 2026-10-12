-- Una caja solo puede tener una sesion abierta. La verificacion estaba solo en el codigo
-- (findFirst + create), asi que un doble clic en "Abrir caja" o dos pestanas podian abrir dos
-- sesiones de la misma caja. El punto de venta registraba las ventas en una de ellas y la pantalla
-- de Caja mostraba otra: al cerrar una aparecia la siguiente, con un "esperado" que no cuadraba.
--
-- 1) Deja abierta solo la sesion mas reciente de cada caja. Las demas se cierran sin diferencia
--    (contado = esperado), asi que no generan asiento de sobrante ni faltante; el esperado incluye
--    sus movimientos de efectivo, igual que un cierre normal.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "cashRegisterId" ORDER BY "openedAt" DESC) AS rn
  FROM "cash_sessions"
  WHERE "status" = 'OPEN'
),
expected AS (
  SELECT s."id",
         s."openingAmount" + COALESCE((
           SELECT SUM(CASE
                        WHEN m."type" IN ('SALE_IN', 'INCOME', 'DEPOSIT') THEN m."amount"
                        WHEN m."type" IN ('EXPENSE', 'WITHDRAWAL') THEN -m."amount"
                        ELSE 0
                      END)
           FROM "cash_movements" m
           WHERE m."cashSessionId" = s."id"
         ), 0) AS amount
  FROM "cash_sessions" s
  JOIN ranked r ON r.id = s.id AND r.rn > 1
)
UPDATE "cash_sessions" s
SET "status" = 'CLOSED',
    "closedAt" = CURRENT_TIMESTAMP,
    "closedByUserId" = s."openedByUserId",
    "closingAmountExpected" = e.amount,
    "closingAmountCounted" = e.amount,
    "difference" = 0,
    "notes" = 'Cerrada automaticamente: era una sesion duplicada de la misma caja (sin asiento de diferencia)'
FROM expected e
WHERE s."id" = e."id";

-- 2) Desde ahora la base de datos lo impide.
CREATE UNIQUE INDEX "cash_sessions_one_open_per_register" ON "cash_sessions" ("cashRegisterId") WHERE "status" = 'OPEN';
