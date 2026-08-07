-- CreateTable
CREATE TABLE "whatsapp_delivery_logs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_delivery_logs_companyId_idx" ON "whatsapp_delivery_logs"("companyId");

-- CreateIndex
CREATE INDEX "whatsapp_delivery_logs_referenceId_idx" ON "whatsapp_delivery_logs"("referenceId");
