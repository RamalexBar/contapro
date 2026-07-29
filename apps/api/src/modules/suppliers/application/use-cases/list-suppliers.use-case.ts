import type { ISupplierRepository, SupplierRecord } from "../../domain/supplier.repository";

export class ListSuppliersUseCase {
  constructor(private readonly repo: ISupplierRepository) {}

  execute(search?: string): Promise<SupplierRecord[]> {
    return this.repo.list(search);
  }
}
