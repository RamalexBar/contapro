import { basePrisma } from "@erp/database";
import type { IProductPhotoRepository } from "../domain/product-photo.repository";

/**
 * basePrisma: el caso de uso ya confirmo que el producto es de la empresa (findByIdOrThrow), y la ruta publica que
 * sirve la foto no tiene contexto de empresa (la protege la firma de la direccion).
 */
export class PrismaProductPhotoRepository implements IProductPhotoRepository {
  async save(productId: string, companyId: string, mimeType: string, data: Buffer): Promise<Date> {
    const bytes = new Uint8Array(data);
    const row = await basePrisma.productPhoto.upsert({
      where: { productId },
      create: { productId, companyId, mimeType, data: bytes },
      update: { mimeType, data: bytes },
      select: { updatedAt: true },
    });
    return row.updatedAt;
  }

  async remove(productId: string): Promise<void> {
    await basePrisma.productPhoto.deleteMany({ where: { productId } });
  }

  async findMany(companyId: string, productIds: string[]): Promise<Map<string, Buffer>> {
    if (!productIds.length) return new Map();
    const rows = await basePrisma.productPhoto.findMany({ where: { companyId, productId: { in: productIds } }, select: { productId: true, data: true } });
    return new Map(rows.map((r) => [r.productId, Buffer.from(r.data)]));
  }

  async findForServing(productId: string) {
    const row = await basePrisma.productPhoto.findUnique({ where: { productId } });
    return row ? { mimeType: row.mimeType, data: Buffer.from(row.data), updatedAt: row.updatedAt } : null;
  }
}
