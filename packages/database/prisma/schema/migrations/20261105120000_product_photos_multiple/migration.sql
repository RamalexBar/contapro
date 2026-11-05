-- Hasta 5 fotos por producto (position 0 = la principal) y el archivo en Cloudflare R2 (storageKey) en vez de la
-- base cuando esta configurado. Las fotos que ya existen quedan como la principal de su producto, en la base.
ALTER TABLE "product_photos" DROP CONSTRAINT "product_photos_pkey";
ALTER TABLE "product_photos" ADD COLUMN "id" TEXT;
UPDATE "product_photos" SET "id" = gen_random_uuid()::text;
ALTER TABLE "product_photos" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "product_photos" ADD CONSTRAINT "product_photos_pkey" PRIMARY KEY ("id");
ALTER TABLE "product_photos" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "product_photos" ADD COLUMN "storageKey" TEXT;
ALTER TABLE "product_photos" ALTER COLUMN "data" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "product_photos_productId_position_idx" ON "product_photos"("productId", "position");
