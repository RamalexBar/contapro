-- CreateTable
CREATE TABLE "external_api_requests" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "externalReference" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "responseBody" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_api_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_api_requests_companyId_createdAt_idx" ON "external_api_requests"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "external_api_requests_companyId_endpoint_externalReferenc_key" ON "external_api_requests"("companyId", "endpoint", "externalReference");
