-- AlterTable: datos fiscales DIAN de la empresa (ver tenant.prisma)
ALTER TABLE "companies" ADD COLUMN     "documentType" TEXT,
ADD COLUMN     "dv" TEXT,
ADD COLUMN     "taxRegime" TEXT,
ADD COLUMN     "fiscalResponsibilities" TEXT,
ADD COLUMN     "address" TEXT,
ADD COLUMN     "municipality" TEXT,
ADD COLUMN     "department" TEXT;

-- CreateTable
CREATE TABLE "manual_invoices" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "taxTotal" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "cufe" TEXT,
    "invoiceXmlUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_invoice_items" (
    "id" TEXT NOT NULL,
    "manualInvoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitPrice" DECIMAL(14,4) NOT NULL,
    "taxPercent" DECIMAL(5,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "manual_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "manual_invoices_companyId_branchId_createdAt_idx" ON "manual_invoices"("companyId", "branchId", "createdAt");

-- AddForeignKey
ALTER TABLE "manual_invoice_items" ADD CONSTRAINT "manual_invoice_items_manualInvoiceId_fkey" FOREIGN KEY ("manualInvoiceId") REFERENCES "manual_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: ElectronicInvoice.saleId pasa a nullable, se agrega manualInvoiceId (XOR entre los
-- dos, ver electronic-invoicing.prisma) -- factura manual (sin POS/producto) como sexta entidad
-- fuente de documento electronico, mismo patron que Sale/CreditNote/DebitNote/Purchase.
ALTER TABLE "electronic_invoices" ALTER COLUMN "saleId" DROP NOT NULL;
ALTER TABLE "electronic_invoices" ADD COLUMN     "manualInvoiceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "electronic_invoices_manualInvoiceId_key" ON "electronic_invoices"("manualInvoiceId");

-- AddForeignKey
ALTER TABLE "electronic_invoices" ADD CONSTRAINT "electronic_invoices_manualInvoiceId_fkey" FOREIGN KEY ("manualInvoiceId") REFERENCES "manual_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariante XOR: exactamente uno de saleId/manualInvoiceId debe estar presente. Prisma no expresa
-- esto nativamente, se aplica a mano (ver comentario en electronic-invoicing.prisma).
ALTER TABLE "electronic_invoices" ADD CONSTRAINT "electronic_invoices_source_xor_check"
    CHECK ((("saleId" IS NOT NULL)::int + ("manualInvoiceId" IS NOT NULL)::int) = 1);
