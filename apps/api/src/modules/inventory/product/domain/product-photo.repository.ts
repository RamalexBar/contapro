/** Hasta 5 fotos por producto; la de `position` 0 es la principal (POS, lista de productos, cotizacion). */
export const MAX_PHOTOS_PER_PRODUCT = 5;

export interface ProductPhotoRecord {
  id: string;
  productId: string;
  position: number;
  updatedAt: Date;
}

export interface StoredProductPhoto {
  mimeType: string;
  data: Buffer;
  updatedAt: Date;
}

export interface IProductPhotoRepository {
  /** Las fotos de un producto, la principal primero. */
  list(productId: string): Promise<ProductPhotoRecord[]>;
  /** Agrega una foto al final (si es la primera, queda como principal). */
  add(productId: string, companyId: string, mimeType: string, data: Buffer): Promise<ProductPhotoRecord>;
  /** Quita la foto y corre las demas (si era la principal, la siguiente pasa a serlo). */
  remove(productId: string, photoId: string): Promise<void>;
  /** Pone esa foto de principal; las demas conservan su orden detras. */
  setMain(productId: string, photoId: string): Promise<void>;
  /** Sin contexto de empresa: la usa la ruta publica que sirve la foto por su direccion firmada. */
  findForServing(photoId: string): Promise<StoredProductPhoto | null>;
  /** La foto principal de varios productos de la empresa, para un documento (ej. el PDF de una cotizacion). */
  findMainPhotos(companyId: string, productIds: string[]): Promise<Map<string, Buffer>>;
}
