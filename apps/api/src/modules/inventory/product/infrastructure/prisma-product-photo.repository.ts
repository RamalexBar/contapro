import { randomUUID } from "node:crypto";
import { basePrisma } from "@erp/database";
import type { IObjectStorage } from "../../../../shared/storage/object-storage";
import type { IProductPhotoRepository, ProductPhotoRecord, StoredProductPhoto } from "../domain/product-photo.repository";

const EXTENSION: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Llave del archivo en R2: por empresa, para poder borrar todo lo de una empresa. */
export const productPhotoKey = (companyId: string, productId: string, photoId: string, mimeType: string) =>
  `companies/${companyId}/products/${productId}/${photoId}.${EXTENSION[mimeType] ?? "bin"}`;

/**
 * basePrisma: el caso de uso ya confirmo que el producto es de la empresa (findByIdOrThrow), y la ruta publica que
 * sirve la foto no tiene contexto de empresa (la protege la firma de la direccion).
 *
 * Con `storage` (Cloudflare R2) el archivo va alla y la fila solo guarda la llave; sin el, los bytes van en la fila,
 * como antes. Las fotos viejas (en la base) se siguen sirviendo igual despues de configurar R2.
 */
export class PrismaProductPhotoRepository implements IProductPhotoRepository {
  constructor(private readonly storage: IObjectStorage | null) {}

  async list(productId: string): Promise<ProductPhotoRecord[]> {
    return basePrisma.productPhoto.findMany({
      where: { productId },
      orderBy: [{ position: "asc" }, { updatedAt: "asc" }],
      select: { id: true, productId: true, position: true, updatedAt: true },
    });
  }

  async add(productId: string, companyId: string, mimeType: string, data: Buffer): Promise<ProductPhotoRecord> {
    const id = randomUUID();
    let storageKey: string | null = null;
    if (this.storage) {
      storageKey = productPhotoKey(companyId, productId, id, mimeType);
      // Primero el archivo: si R2 falla no queda una fila apuntando a nada
      await this.storage.put(storageKey, mimeType, data);
    }
    const last = await basePrisma.productPhoto.findFirst({ where: { productId }, orderBy: { position: "desc" }, select: { position: true } });
    return basePrisma.productPhoto.create({
      data: {
        id,
        productId,
        companyId,
        mimeType,
        position: last ? last.position + 1 : 0,
        storageKey,
        data: storageKey ? null : new Uint8Array(data),
      },
      select: { id: true, productId: true, position: true, updatedAt: true },
    });
  }

  async remove(productId: string, photoId: string): Promise<void> {
    const row = await basePrisma.productPhoto.findFirst({ where: { id: photoId, productId }, select: { storageKey: true } });
    if (!row) return;
    await basePrisma.productPhoto.delete({ where: { id: photoId } });
    await this.renumber(productId);
    // Despues de la fila: si R2 falla queda un archivo huerfano (inofensivo), nunca una foto rota en pantalla
    if (row.storageKey && this.storage) {
      await this.storage.delete(row.storageKey).catch((err) => console.error("No se pudo borrar la foto en R2:", err));
    }
  }

  async setMain(productId: string, photoId: string): Promise<void> {
    const photos = await this.list(productId);
    const ordered = [...photos.filter((p) => p.id === photoId), ...photos.filter((p) => p.id !== photoId)];
    await this.applyOrder(ordered.map((p) => p.id), photos);
  }

  async findForServing(photoId: string): Promise<StoredProductPhoto | null> {
    const row = await basePrisma.productPhoto.findUnique({ where: { id: photoId } });
    if (!row) return null;
    const data = await this.readBytes(row);
    return data ? { mimeType: row.mimeType, data, updatedAt: row.updatedAt } : null;
  }

  async findMainPhotos(companyId: string, productIds: string[]): Promise<Map<string, Buffer>> {
    if (!productIds.length) return new Map();
    const rows = await basePrisma.productPhoto.findMany({ where: { companyId, productId: { in: productIds }, position: 0 } });
    const result = new Map<string, Buffer>();
    for (const row of rows) {
      const data = await this.readBytes(row);
      if (data) result.set(row.productId, data);
    }
    return result;
  }

  private async readBytes(row: { data: Uint8Array | null; storageKey: string | null }): Promise<Buffer | null> {
    if (row.data) return Buffer.from(row.data);
    if (row.storageKey && this.storage) return this.storage.get(row.storageKey);
    return null;
  }

  private async renumber(productId: string): Promise<void> {
    const photos = await this.list(productId);
    await this.applyOrder(photos.map((p) => p.id), photos);
  }

  /** Solo actualiza las que cambian de lugar (cambiar la posicion cambia su updatedAt, y con el su direccion). */
  private async applyOrder(ids: string[], current: ProductPhotoRecord[]): Promise<void> {
    const position = new Map(current.map((p) => [p.id, p.position]));
    await basePrisma.$transaction(
      ids.flatMap((id, index) => (position.get(id) === index ? [] : [basePrisma.productPhoto.update({ where: { id }, data: { position: index } })]))
    );
  }
}
