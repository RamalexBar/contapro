-- Pago de prestaciones sociales: prima semestral, consolidacion anual de cesantias y liquidacion de contrato.
CREATE TABLE "benefit_settlements" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "grossTotal" DECIMAL(14,2) NOT NULL,
    "withholding" DECIMAL(14,2) NOT NULL,
    "netPay" DECIMAL(14,2) NOT NULL,
    "toSeveranceFund" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "detail" JSONB NOT NULL,
    "terminationReason" TEXT,
    "journalEntryId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benefit_settlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "benefit_settlements_employeeId_type_periodStart_key" ON "benefit_settlements"("employeeId", "type", "periodStart");
CREATE INDEX "benefit_settlements_companyId_type_idx" ON "benefit_settlements"("companyId", "type");

ALTER TABLE "benefit_settlements" ADD CONSTRAINT "benefit_settlements_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
