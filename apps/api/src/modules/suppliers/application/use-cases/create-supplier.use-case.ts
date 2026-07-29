import type { AuditService } from "../../../audit/application/audit.service";
import type { CreateSupplierData, ISupplierRepository, SupplierRecord } from "../../domain/supplier.repository";

export class CreateSupplierUseCase {
  constructor(private readonly repo: ISupplierRepository, private readonly audit: AuditService) {}

  async execute(data: CreateSupplierData): Promise<SupplierRecord> {
    const supplier = await this.repo.create(data);

    await this.audit.record({
      action: "SUPPLIER_CREATED",
      entityType: "Supplier",
      entityId: supplier.id,
      description: `Proveedor creado: ${supplier.name} (NIT ${supplier.nit})`,
    });

    return supplier;
  }
}
