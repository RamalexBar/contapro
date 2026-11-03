-- Foto del producto (una por producto), en la base: el navegador la achica a ~400 px antes de subirla.
CREATE TABLE "product_photos" (
    "productId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_photos_pkey" PRIMARY KEY ("productId")
);

-- CreateIndex
CREATE INDEX "product_photos_companyId_idx" ON "product_photos"("companyId");

-- AddForeignKey
ALTER TABLE "product_photos" ADD CONSTRAINT "product_photos_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
