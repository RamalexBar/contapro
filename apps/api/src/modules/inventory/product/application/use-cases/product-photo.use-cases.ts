import { getTenantContext } from "../../../../../shared/context/request-context";
import { ValidationError } from "../../../../../shared/errors/app-error";
import {
  MAX_PHOTOS_PER_PRODUCT,
  type IProductPhotoRepository,
  type ProductPhotoRecord,
  type StoredProductPhoto,
} from "../../domain/product-photo.repository";
import type { IProductRepository } from "../../domain/product.repository";
import type { PhotoUrlSigner } from "../photo-url-signer";

/** El navegador la achica a ~400 px (~30-40 KB); este tope solo frena archivos que no pasaron por ahi. */
export const MAX_PRODUCT_PHOTO_BYTES = 300_000;
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

export interface ProductPhotoView {
  id: string;
  path: string;
  isMain: boolean;
}

function parsePhoto(dataUrl: string): { mimeType: string; data: Buffer } {
  const match = DATA_URL.exec(dataUrl);
  if (!match) throw new ValidationError("La foto debe ser una imagen JPG, PNG o WEBP");
  const data = Buffer.from(match[2]!, "base64");
  if (data.length === 0) throw new ValidationError("La foto esta vacia");
  if (data.length > MAX_PRODUCT_PHOTO_BYTES) throw new ValidationError("La foto es muy pesada: use una de menos de 300 KB");
  return { mimeType: match[1]!, data };
}

const toView = (signer: PhotoUrlSigner) => (p: ProductPhotoRecord): ProductPhotoView => ({
  id: p.id,
  path: signer.path(p.id, p.updatedAt),
  isMain: p.position === 0,
});

/** Las fotos de un producto con sus direcciones firmadas, la principal primero. */
export class ListProductPhotosUseCase {
  constructor(
    private readonly productRepo: IProductRepository,
    private readonly photoRepo: IProductPhotoRepository,
    private readonly signer: PhotoUrlSigner
  ) {}

  async execute(productId: string): Promise<ProductPhotoView[]> {
    // findByIdOrThrow confirma que el producto es de esta empresa
    await this.productRepo.findByIdOrThrow(productId);
    return (await this.photoRepo.list(productId)).map(toView(this.signer));
  }
}

/** Agregar una foto (llega como data URL desde el navegador); maximo MAX_PHOTOS_PER_PRODUCT. */
export class AddProductPhotoUseCase {
  constructor(
    private readonly productRepo: IProductRepository,
    private readonly photoRepo: IProductPhotoRepository,
    private readonly signer: PhotoUrlSigner
  ) {}

  async execute(productId: string, dataUrl: string): Promise<ProductPhotoView[]> {
    const { mimeType, data } = parsePhoto(dataUrl);
    await this.productRepo.findByIdOrThrow(productId);
    if ((await this.photoRepo.list(productId)).length >= MAX_PHOTOS_PER_PRODUCT) {
      throw new ValidationError(`El producto ya tiene ${MAX_PHOTOS_PER_PRODUCT} fotos: quite una para agregar otra`);
    }
    await this.photoRepo.add(productId, getTenantContext().companyId, mimeType, data);
    return (await this.photoRepo.list(productId)).map(toView(this.signer));
  }
}

/**
 * Poner o cambiar LA foto principal (PUT /products/:id/photo, el comportamiento de antes de las 5 fotos): reemplaza
 * la principal y deja las demas como estan.
 */
export class SetProductPhotoUseCase {
  constructor(
    private readonly productRepo: IProductRepository,
    private readonly photoRepo: IProductPhotoRepository,
    private readonly signer: PhotoUrlSigner
  ) {}

  async execute(productId: string, dataUrl: string): Promise<{ photoPath: string }> {
    const { mimeType, data } = parsePhoto(dataUrl);
    await this.productRepo.findByIdOrThrow(productId);
    const current = await this.photoRepo.list(productId);
    const main = current.find((p) => p.position === 0);
    if (main) await this.photoRepo.remove(productId, main.id);
    else if (current.length >= MAX_PHOTOS_PER_PRODUCT) {
      throw new ValidationError(`El producto ya tiene ${MAX_PHOTOS_PER_PRODUCT} fotos: quite una para agregar otra`);
    }
    const added = await this.photoRepo.add(productId, getTenantContext().companyId, mimeType, data);
    await this.photoRepo.setMain(productId, added.id);
    return { photoPath: this.signer.path(added.id, added.updatedAt) };
  }
}

/** Quitar una foto (sin photoId: la principal, como DELETE /products/:id/photo de antes). */
export class RemoveProductPhotoUseCase {
  constructor(private readonly productRepo: IProductRepository, private readonly photoRepo: IProductPhotoRepository) {}

  async execute(productId: string, photoId?: string): Promise<void> {
    await this.productRepo.findByIdOrThrow(productId);
    const photos = await this.photoRepo.list(productId);
    const target = photoId ? photos.find((p) => p.id === photoId) : photos.find((p) => p.position === 0);
    if (target) await this.photoRepo.remove(productId, target.id);
  }
}

export class SetMainProductPhotoUseCase {
  constructor(private readonly productRepo: IProductRepository, private readonly photoRepo: IProductPhotoRepository) {}

  async execute(productId: string, photoId: string): Promise<void> {
    await this.productRepo.findByIdOrThrow(productId);
    if (!(await this.photoRepo.list(productId)).some((p) => p.id === photoId)) {
      throw new ValidationError("Esa foto no es de este producto");
    }
    await this.photoRepo.setMain(productId, photoId);
  }
}

/** La ruta publica: solo con la firma correcta y la version vigente. */
export class ServeProductPhotoUseCase {
  constructor(private readonly photoRepo: IProductPhotoRepository, private readonly signer: PhotoUrlSigner) {}

  async execute(photoId: string, version: string, signature: string): Promise<StoredProductPhoto | null> {
    if (!this.signer.verify(photoId, version, signature)) return null;
    const photo = await this.photoRepo.findForServing(photoId);
    // Una direccion vieja (de antes de cambiar la foto) ya no sirve
    if (!photo || String(photo.updatedAt.getTime()) !== version) return null;
    return photo;
  }
}
