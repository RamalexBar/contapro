import type { AuditService } from "../../../audit/application/audit.service";
import type { CostCenterRecord, ICostCenterRepository, UpdateCostCenterData } from "../../domain/cost-center.repository";

export class UpdateCostCenterUseCase {
  constructor(private readonly repo: ICostCenterRepository, private readonly audit: AuditService) {}

  async execute(id: string, data: UpdateCostCenterData): Promise<CostCenterRecord> {
    const costCenter = await this.repo.update(id, data);

    await this.audit.record({
      action: "COST_CENTER_UPDATED",
      entityType: "CostCenter",
      entityId: costCenter.id,
      description: `Centro de costo actualizado: ${costCenter.code} ${costCenter.name}`,
    });

    return costCenter;
  }
}
