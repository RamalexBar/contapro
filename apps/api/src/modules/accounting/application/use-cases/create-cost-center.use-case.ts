import type { AuditService } from "../../../audit/application/audit.service";
import type { CostCenterRecord, CreateCostCenterData, ICostCenterRepository } from "../../domain/cost-center.repository";

export class CreateCostCenterUseCase {
  constructor(private readonly repo: ICostCenterRepository, private readonly audit: AuditService) {}

  async execute(data: CreateCostCenterData): Promise<CostCenterRecord> {
    const costCenter = await this.repo.create(data);

    await this.audit.record({
      action: "COST_CENTER_CREATED",
      entityType: "CostCenter",
      entityId: costCenter.id,
      description: `Centro de costo creado: ${costCenter.code} ${costCenter.name}`,
    });

    return costCenter;
  }
}
