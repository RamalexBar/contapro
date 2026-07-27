import type { IProductRepository, ProductListItem } from "../../domain/product.repository";

export class ListProductsUseCase {
  constructor(private readonly repo: IProductRepository) {}
  async execute(search?: string): Promise<ProductListItem[]> {
    return this.repo.list(search);
  }
}
