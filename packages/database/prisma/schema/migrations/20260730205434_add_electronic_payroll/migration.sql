-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "municipalityCode" TEXT,
ADD COLUMN     "payrollElectronicPrefix" TEXT,
ADD COLUMN     "payrollElectronicSequence" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "middleName" TEXT,
ADD COLUMN     "secondLastName" TEXT,
ADD COLUMN     "workerSubtype" TEXT NOT NULL DEFAULT '00',
ADD COLUMN     "workerType" TEXT NOT NULL DEFAULT '01';

-- AlterTable
ALTER TABLE "payroll_details" ADD COLUMN     "cune" TEXT,
ADD COLUMN     "xmlUrl" TEXT;

-- CreateTable
CREATE TABLE "electronic_payrolls" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "payrollDetailId" TEXT NOT NULL,
    "prefix" TEXT,
    "number" INTEGER NOT NULL,
    "fullNumber" TEXT NOT NULL,
    "cune" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "employeeDocumentType" TEXT NOT NULL,
    "employeeDocumentNumber" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "grossTotal" DECIMAL(14,2) NOT NULL,
    "totalDeductions" DECIMAL(14,2) NOT NULL,
    "netPay" DECIMAL(14,2) NOT NULL,
    "environment" TEXT NOT NULL,
    "xmlContent" TEXT NOT NULL,
    "status" "ElectronicInvoiceStatus" NOT NULL DEFAULT 'GENERATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedXmlContent" TEXT,
    "dianTrackingId" TEXT,
    "dianResponseXml" TEXT,
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "electronic_payrolls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "electronic_payrolls_payrollDetailId_key" ON "electronic_payrolls"("payrollDetailId");

-- CreateIndex
CREATE INDEX "electronic_payrolls_companyId_branchId_createdAt_idx" ON "electronic_payrolls"("companyId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "electronic_payrolls_companyId_status_idx" ON "electronic_payrolls"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "electronic_payrolls_companyId_fullNumber_key" ON "electronic_payrolls"("companyId", "fullNumber");

-- AddForeignKey
ALTER TABLE "electronic_payrolls" ADD CONSTRAINT "electronic_payrolls_payrollDetailId_fkey" FOREIGN KEY ("payrollDetailId") REFERENCES "payroll_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
