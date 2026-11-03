import type { IProductRepository, ProductListItem } from "../../domain/product.repository";
import type { PhotoUrlSigner } from "../photo-url-signer";

export type ProductListView = Omit<ProductListItem, "photoUpdatedAt"> & {
  /** Direccion firmada de la foto (relativa a la API), o null si no tiene. */
  photoPath: string | null;
};

export class ListProductsUseCase {
  constructor(private readonly repo: IProductRepository, private readonly signer: PhotoUrlSigner) {}
  async execute(search?: string): Promise<ProductListView[]> {
    return (await this.repo.list(search)).map(({ photoUpdatedAt, ...p }) => ({
      ...p,
      photoPath: photoUpdatedAt ? this.signer.path(p.id, photoUpdatedAt) : null,
    }));
  }
}
