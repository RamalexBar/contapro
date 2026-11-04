-- Factura electronica que Contapro (como empresa) le emite a cada cliente por el pago de su suscripcion.
ALTER TABLE "subscription_payments" ADD COLUMN "manualInvoiceId" TEXT;
ALTER TABLE "subscription_payments" ADD COLUMN "invoicedAt" TIMESTAMP(3);
ALTER TABLE "subscription_payments" ADD COLUMN "invoiceError" TEXT;
