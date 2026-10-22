-- Ubicacion del producto en la estanteria/bodega (ej. "Pasillo 3 - Estante B"), para encontrarlo al
-- vender: se muestra en el punto de venta.
ALTER TABLE "products" ADD COLUMN "location" TEXT;
