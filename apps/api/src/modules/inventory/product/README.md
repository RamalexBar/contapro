# Productos

## Fotos del producto (2026-11-03; hasta 5 y Cloudflare R2 desde 2026-11-05)

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
- **Hasta 5 fotos** (2026-11-05): `product_photos` paso a tener `id` propio y `position` (0 = la principal: la de la
  lista, el POS y la cotizacion). `GET/POST /products/:id/photos`, `DELETE /products/:id/photos/:photoId`,
  `POST /products/:id/photos/:photoId/main`. Los `PUT/DELETE /products/:id/photo` de antes siguen: reemplazan / quitan
  la principal. Al quitar una, las demas se corren (si era la principal, la siguiente pasa a serlo). La direccion
  firmada ahora es por foto (`/product-photos/:photoId`); cambiar el orden cambia su version. En la web: clic en la
  miniatura → «Fotos de …» (agregar, «Hacer principal», quitar). Cotizacion: `findMainPhotos`.
- **Cloudflare R2** (`shared/storage/r2-object-storage.ts`): con las 4 variables `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` el archivo va a R2 (llave `companies/<empresa>/products/<producto>/<foto>.jpg`,
  `storageKey`) y la fila no guarda bytes; sin ellas, a la base como antes. Las fotos viejas en la base se siguen
  sirviendo igual. Bucket privado: la API sirve la foto por su direccion firmada (R2 no cobra la descarga). Firma AWS
  SigV4 escrita a mano (sin SDK), probada con el ejemplo oficial de S3. Borrar una empresa borra tambien sus archivos
  en R2 (`DeleteCompanyUseCase`; los que fallen se cuentan en el aviso). **No verificado contra R2 real todavia**: falta
  que el usuario cree el bucket y cargue las variables en Render.
- Pendiente: la app movil todavia no muestra fotos.

Verificado en vivo (local): una imagen de 900×600 subida desde la lista quedo de 400×267 y 7 KB, se ve en la lista
y en el punto de venta; firma alterada o sin firma → 404.
