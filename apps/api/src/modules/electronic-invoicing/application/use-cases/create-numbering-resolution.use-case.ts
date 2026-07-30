import type { AuditService } from "../../../audit/application/audit.service";
import type {
  CreateNumberingResolutionData,
  IInvoiceNumberingResolutionRepository,
  NumberingResolutionRecord,
} from "../../domain/invoice-numbering-resolution.repository";

export class CreateNumberingResolutionUseCase {
  constructor(
    private readonly repo: IInvoiceNumberingResolutionRepository,
    private readonly audit: AuditService
  ) {}

  async execute(data: CreateNumberingResolutionData): Promise<NumberingResolutionRecord> {
    const resolution = await this.repo.create(data);

    await this.audit.record({
      action: "INVOICE_NUMBERING_RESOLUTION_CREATED",
      entityType: "InvoiceNumberingResolution",
      entityId: resolution.id,
      description: `Resolucion de numeracion DIAN registrada: ${resolution.resolutionNumber} (${resolution.prefix} ${resolution.rangeFrom}-${resolution.rangeTo})`,
    });

    return resolution;
  }
}
