-- Salario integral (art. 132 CST) y soportes de retencion en la fuente por empleado (valores mensuales).
ALTER TABLE "employees" ADD COLUMN "salaryType" TEXT NOT NULL DEFAULT 'ORDINARY';
ALTER TABLE "employees" ADD COLUMN "withholdingDependents" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "employees" ADD COLUMN "withholdingHousingInterest" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "employees" ADD COLUMN "withholdingPrepaidHealth" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "employees" ADD COLUMN "withholdingVoluntaryPension" DECIMAL(14,2) NOT NULL DEFAULT 0;
