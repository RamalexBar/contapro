import type { AuditService } from "../../../audit/application/audit.service";
import type {
  CreateWithholdingConceptData,
  IWithholdingConceptRepository,
  WithholdingConceptRecord,
} from "../../domain/withholding-concept.repository";

export class CreateWithholdingConceptUseCase {
  constructor(private readonly repo: IWithholdingConceptRepository, private readonly audit: AuditService) {}

  async execute(data: CreateWithholdingConceptData): Promise<WithholdingConceptRecord> {
    const concept = await this.repo.create(data);

    await this.audit.record({
      action: "WITHHOLDING_CONCEPT_CREATED",
      entityType: "WithholdingConcept",
      entityId: concept.id,
      description: `Concepto de retencion creado: ${concept.code} ${concept.name} (${concept.type} ${concept.ratePercent}%)`,
    });

    return concept;
  }
}
