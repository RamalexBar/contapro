-- Cada sucursal necesita su propia caja para poder vender en ella. Antes solo la sucursal
-- principal recibia una (RegisterCompanyUseCase); las creadas despues desde Inventario ->
-- Sucursales quedaban sin caja. Desde ahora CreateBranchUseCase crea la caja junto con la
-- sucursal; esto se la da a las sucursales que ya existian sin una.
INSERT INTO "cash_registers" ("id", "companyId", "branchId", "code", "name", "isActive", "createdAt")
SELECT gen_random_uuid()::text, b."companyId", b."id", 'CAJA1', 'Caja ' || b."name", true, CURRENT_TIMESTAMP
FROM "branches" b
WHERE NOT EXISTS (SELECT 1 FROM "cash_registers" c WHERE c."branchId" = b."id");
