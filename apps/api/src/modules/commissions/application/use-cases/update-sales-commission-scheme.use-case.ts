import type { AuditService } from "../../../audit/application/audit.service";
import type {
  ISalesCommissionSchemeRepository,
  SalesCommissionSchemeRecord,
  UpdateSalesCommissionSchemeData,
} from "../../domain/sales-commission-scheme.repository";

export class UpdateSalesCommissionSchemeUseCase {
  constructor(private readonly repo: ISalesCommissionSchemeRepository, private readonly audit: AuditService) {}

  async execute(id: string, data: UpdateSalesCommissionSchemeData): Promise<SalesCommissionSchemeRecord> {
    const scheme = await this.repo.update(id, data);

    await this.audit.record({
      action: "COMMISSION_SCHEME_UPDATED",
      entityType: "SalesCommissionScheme",
      entityId: scheme.id,
      description: `Esquema de comision actualizado: ${scheme.ratePercent}%`,
    });

    return scheme;
  }
}
