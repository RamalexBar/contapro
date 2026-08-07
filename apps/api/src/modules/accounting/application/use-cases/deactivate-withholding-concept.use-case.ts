import type { AuditService } from "../../../audit/application/audit.service";
import type { IWithholdingConceptRepository, WithholdingConceptRecord } from "../../domain/withholding-concept.repository";

export class DeactivateWithholdingConceptUseCase {
  constructor(private readonly repo: IWithholdingConceptRepository, private readonly audit: AuditService) {}

  async execute(id: string): Promise<WithholdingConceptRecord> {
    const concept = await this.repo.deactivate(id);

    await this.audit.record({
      action: "WITHHOLDING_CONCEPT_DEACTIVATED",
      entityType: "WithholdingConcept",
      entityId: concept.id,
      description: `Concepto de retencion desactivado: ${concept.code} ${concept.name}`,
    });

    return concept;
  }
}
