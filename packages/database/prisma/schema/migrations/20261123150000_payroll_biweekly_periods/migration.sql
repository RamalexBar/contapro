-- Nomina quincenal: dos periodos BIWEEKLY en el mismo mes (del 1 al 15 y del 16 al ultimo dia).
DROP INDEX "payrolls_companyId_branchId_year_month_periodType_key";
CREATE UNIQUE INDEX "payrolls_companyId_branchId_year_month_periodType_startDate_key" ON "payrolls"("companyId", "branchId", "year", "month", "periodType", "startDate");
