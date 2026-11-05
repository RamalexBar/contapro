import type { IProductRepository, ProductListItem } from "../../domain/product.repository";
import type { PhotoUrlSigner } from "../photo-url-signer";

export type ProductListView = Omit<ProductListItem, "mainPhoto"> & {
  /** Direccion firmada de la foto principal (relativa a la API), o null si no tiene. */
  photoPath: string | null;
};

export class ListProductsUseCase {
  constructor(private readonly repo: IProductRepository, private readonly signer: PhotoUrlSigner) {}
  async execute(search?: string): Promise<ProductListView[]> {
    return (await this.repo.list(search)).map(({ mainPhoto, ...p }) => ({
      ...p,
      photoPath: mainPhoto ? this.signer.path(mainPhoto.id, mainPhoto.updatedAt) : null,
    }));
  }
}
