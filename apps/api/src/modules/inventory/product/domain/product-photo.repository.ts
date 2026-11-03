/** La foto del producto (una por producto), guardada en la base. */
export interface StoredProductPhoto {
  mimeType: string;
  data: Buffer;
  updatedAt: Date;
}

export interface IProductPhotoRepository {
  /** Guarda (o reemplaza) la foto; devuelve la fecha con la que queda (es la "version" de su direccion). */
  save(productId: string, companyId: string, mimeType: string, data: Buffer): Promise<Date>;
  remove(productId: string): Promise<void>;
  /** Sin contexto de empresa: la usa la ruta publica que sirve la foto por su direccion firmada. */
  findForServing(productId: string): Promise<StoredProductPhoto | null>;
  /** Las fotos de varios productos de la empresa, para un documento (ej. el PDF de una cotizacion). */
  findMany(companyId: string, productIds: string[]): Promise<Map<string, Buffer>>;
}
