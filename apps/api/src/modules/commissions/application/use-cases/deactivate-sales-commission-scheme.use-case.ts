import type { AuditService } from "../../../audit/application/audit.service";
import type { ISalesCommissionSchemeRepository, SalesCommissionSchemeRecord } from "../../domain/sales-commission-scheme.repository";

export class DeactivateSalesCommissionSchemeUseCase {
  constructor(private readonly repo: ISalesCommissionSchemeRepository, private readonly audit: AuditService) {}

  async execute(id: string): Promise<SalesCommissionSchemeRecord> {
    const scheme = await this.repo.deactivate(id);

    await this.audit.record({
      action: "COMMISSION_SCHEME_DEACTIVATED",
      entityType: "SalesCommissionScheme",
      entityId: scheme.id,
      description: `Esquema de comision desactivado para el vendedor ${scheme.sellerUserId}`,
    });

    return scheme;
  }
}
