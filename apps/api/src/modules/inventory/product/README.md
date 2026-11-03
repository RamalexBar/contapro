# Productos

## Foto del producto (2026-11-03)

Una foto por producto, **guardada en la base** (tabla `product_photos`: `productId`, `companyId`, `mimeType`, bytes),
decidido con el usuario para no depender de un servicio de archivos. El navegador la achica a 400 px en JPG antes de
subirla (`apps/web/src/features/inventory/components/ProductPhoto.tsx`): queda en ~10-40 KB.

- `PUT /products/:id/photo { dataUrl }` y `DELETE /products/:id/photo` (permiso `product.update`). Solo JPG/PNG/WEBP de
  hasta 300 KB, y solo productos de la empresa (`findByIdOrThrow`).
- La lista de productos **no** trae los bytes: trae `photoPath`, una direccion firmada
  `/product-photos/:id?v=<version>&s=<firma>` (`application/photo-url-signer.ts`, HMAC con `JWT_ACCESS_SECRET`).
- `GET /api/product-photos/:id` es **publica** (un `<img>` no manda la sesion; va montada antes de los routers con
  sesion): solo responde con la firma correcta para ese producto y la version vigente, si no 404. Como la direccion
  cambia cuando cambia la foto, se sirve con `Cache-Control: public, max-age=31536000, immutable`. La web esta en otro
  dominio que la API, por eso `Cross-Origin-Resource-Policy: cross-origin`.
- Se ve en Inventario → Productos (columna Foto: clic para poner o cambiar, «Quitar») y en el punto de venta.
- **Cotizacion en PDF** (2026-11-03): cada renglon lleva la miniatura de la foto a la izquierda del nombre
  (`shared/pdf/simple-document-renderer.ts`, `image` opcional por renglon; solo JPG/PNG, otro formato se omite). La
  cotizacion pide las fotos de sus productos de una vez (`IProductPhotoRepository.findMany`, exportado como
  `productPhotoRepo`). Una fila con foto no se parte entre dos hojas.
- Pendiente: la app movil todavia no la muestra. Si algun dia pesa demasiado en la base,
  se puede pasar a un servicio de archivos cambiando solo `PrismaProductPhotoRepository` y la ruta que la sirve.

Verificado en vivo (local): una imagen de 900×600 subida desde la lista quedo de 400×267 y 7 KB, se ve en la lista
y en el punto de venta; firma alterada o sin firma → 404.
