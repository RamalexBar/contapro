-- Bonificaciones no salariales (2026-11-27).
CREATE TABLE "payroll_bonuses" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_bonuses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_bonuses_companyId_employeeId_date_idx" ON "payroll_bonuses"("companyId", "employeeId", "date");

ALTER TABLE "payroll_bonuses" ADD CONSTRAINT "payroll_bonuses_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
