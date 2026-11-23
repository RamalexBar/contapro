-- Exoneracion de aportes art. 114-1 E.T. por empresa (la marca cada empresa; por defecto no aplica).
ALTER TABLE "companies" ADD COLUMN "payrollExemptArt1141" BOOLEAN NOT NULL DEFAULT false;

-- Parametros legales oficiales de 2026 (verificados 2026-11-23): salario minimo $1.750.905 y auxilio
-- de transporte $249.095 (Decretos 1469 y 1470 de 2025, ratificados por el Decreto 0159 de 2026);
-- UVT $52.374 (Resolucion DIAN 000238 de 2025). Recargo dominical 80% y divisor 220 son los vigentes
-- al 1 de enero de 2026; los cambios de julio de 2026 (90% y jornada de 42 h -> divisor 210) los
-- aplica el motor por fecha (payroll-calculator.ts). Reemplaza los valores de EJEMPLO del seed.
UPDATE "payroll_parameters"
SET "minimumWage" = 1750905,
    "transportAllowance" = 249095,
    "uvt" = 52374,
    "sundayHolidaySurchargePercent" = 80,
    "monthlyHoursDivisor" = 220
WHERE "year" = 2026;
