import type { AuditService } from "../../../audit/application/audit.service";
import type {
  IWithholdingConceptRepository,
  UpdateWithholdingConceptData,
  WithholdingConceptRecord,
} from "../../domain/withholding-concept.repository";

export class UpdateWithholdingConceptUseCase {
  constructor(private readonly repo: IWithholdingConceptRepository, private readonly audit: AuditService) {}

  async execute(id: string, data: UpdateWithholdingConceptData): Promise<WithholdingConceptRecord> {
    const concept = await this.repo.update(id, data);

    await this.audit.record({
      action: "WITHHOLDING_CONCEPT_UPDATED",
      entityType: "WithholdingConcept",
      entityId: concept.id,
      description: `Concepto de retencion actualizado: ${concept.code} ${concept.name} (${concept.ratePercent}%)`,
    });

    return concept;
  }
}
