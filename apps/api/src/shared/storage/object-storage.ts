/**
 * Donde se guardan archivos (fotos de productos). Hoy hay una implementacion real: Cloudflare R2
 * (r2-object-storage.ts). Sin configurar, `objectStorage` es null y quien la usa guarda en la base.
 */
export interface IObjectStorage {
  put(key: string, contentType: string, data: Buffer): Promise<void>;
  /** null si el archivo no existe. */
  get(key: string): Promise<Buffer | null>;
  /** No falla si el archivo ya no existe. */
  delete(key: string): Promise<void>;
}
