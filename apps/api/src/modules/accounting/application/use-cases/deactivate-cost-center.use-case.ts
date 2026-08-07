import type { AuditService } from "../../../audit/application/audit.service";
import type { CostCenterRecord, ICostCenterRepository } from "../../domain/cost-center.repository";

export class DeactivateCostCenterUseCase {
  constructor(private readonly repo: ICostCenterRepository, private readonly audit: AuditService) {}

  async execute(id: string): Promise<CostCenterRecord> {
    const costCenter = await this.repo.deactivate(id);

    await this.audit.record({
      action: "COST_CENTER_DEACTIVATED",
      entityType: "CostCenter",
      entityId: costCenter.id,
      description: `Centro de costo desactivado: ${costCenter.code} ${costCenter.name}`,
    });

    return costCenter;
  }
}
