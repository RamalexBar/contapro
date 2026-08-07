import type { AuditService } from "../../../audit/application/audit.service";
import type {
  CreateSalesCommissionSchemeData,
  ISalesCommissionSchemeRepository,
  SalesCommissionSchemeRecord,
} from "../../domain/sales-commission-scheme.repository";

export class CreateSalesCommissionSchemeUseCase {
  constructor(private readonly repo: ISalesCommissionSchemeRepository, private readonly audit: AuditService) {}

  async execute(data: CreateSalesCommissionSchemeData): Promise<SalesCommissionSchemeRecord> {
    const scheme = await this.repo.create(data);

    await this.audit.record({
      action: "COMMISSION_SCHEME_CREATED",
      entityType: "SalesCommissionScheme",
      entityId: scheme.id,
      description: `Esquema de comision creado para el vendedor ${scheme.sellerUserId}: ${scheme.ratePercent}%`,
    });

    return scheme;
  }
}
