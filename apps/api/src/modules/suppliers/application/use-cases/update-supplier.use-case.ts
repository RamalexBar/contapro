import type { AuditService } from "../../../audit/application/audit.service";
import type { ISupplierRepository, SupplierRecord, UpdateSupplierData } from "../../domain/supplier.repository";

/** Corregir los datos de un proveedor (tipo de documento, municipio, declarante...): la exogena y el
 * documento soporte salen de aqui, asi que tienen que poder corregirse sin tocar la base. */
export class UpdateSupplierUseCase {
  constructor(private readonly repo: ISupplierRepository, private readonly audit: AuditService) {}

  async execute(id: string, data: UpdateSupplierData): Promise<SupplierRecord> {
    const before = await this.repo.findByIdOrThrow(id);
    const supplier = await this.repo.update(id, data);
    const changed = (Object.keys(data) as Array<keyof UpdateSupplierData>).filter(
      (key) => data[key] !== undefined && data[key] !== before[key as keyof SupplierRecord]
    );
    await this.audit.record({
      action: "SUPPLIER_UPDATED",
      entityType: "Supplier",
      entityId: id,
      description: `Proveedor editado: ${supplier.name} (${changed.join(", ") || "sin cambios"})`,
      metadata: { changed },
    });
    return supplier;
  }
}
