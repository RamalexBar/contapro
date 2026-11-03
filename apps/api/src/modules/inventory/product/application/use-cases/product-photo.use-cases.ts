import { getTenantContext } from "../../../../../shared/context/request-context";
import { ValidationError } from "../../../../../shared/errors/app-error";
import type { IProductPhotoRepository, StoredProductPhoto } from "../../domain/product-photo.repository";
import type { IProductRepository } from "../../domain/product.repository";
import type { PhotoUrlSigner } from "../photo-url-signer";

/** El navegador la achica a ~400 px (~30-40 KB); este tope solo frena archivos que no pasaron por ahi. */
export const MAX_PRODUCT_PHOTO_BYTES = 300_000;
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

/** Poner o cambiar la foto de un producto (llega como data URL desde el navegador). */
export class SetProductPhotoUseCase {
  constructor(
    private readonly productRepo: IProductRepository,
    private readonly photoRepo: IProductPhotoRepository,
    private readonly signer: PhotoUrlSigner
  ) {}

  async execute(productId: string, dataUrl: string): Promise<{ photoPath: string }> {
    const match = DATA_URL.exec(dataUrl);
    if (!match) throw new ValidationError("La foto debe ser una imagen JPG, PNG o WEBP");
    const data = Buffer.from(match[2]!, "base64");
    if (data.length === 0) throw new ValidationError("La foto esta vacia");
    if (data.length > MAX_PRODUCT_PHOTO_BYTES) throw new ValidationError("La foto es muy pesada: use una de menos de 300 KB");
    // findByIdOrThrow confirma que el producto es de esta empresa
    await this.productRepo.findByIdOrThrow(productId);
    const updatedAt = await this.photoRepo.save(productId, getTenantContext().companyId, match[1]!, data);
    return { photoPath: this.signer.path(productId, updatedAt) };
  }
}

export class RemoveProductPhotoUseCase {
  constructor(private readonly productRepo: IProductRepository, private readonly photoRepo: IProductPhotoRepository) {}

  async execute(productId: string): Promise<void> {
    await this.productRepo.findByIdOrThrow(productId);
    await this.photoRepo.remove(productId);
  }
}

/** La ruta publica: solo con la firma correcta y la version vigente. */
export class ServeProductPhotoUseCase {
  constructor(private readonly photoRepo: IProductPhotoRepository, private readonly signer: PhotoUrlSigner) {}

  async execute(productId: string, version: string, signature: string): Promise<StoredProductPhoto | null> {
    if (!this.signer.verify(productId, version, signature)) return null;
    const photo = await this.photoRepo.findForServing(productId);
    // Una direccion vieja (de antes de cambiar la foto) ya no sirve
    if (!photo || String(photo.updatedAt.getTime()) !== version) return null;
    return photo;
  }
}
