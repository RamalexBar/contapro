import { ValidationError } from "../../../../../shared/errors/app-error";
import type { AuditService } from "../../../../audit/application/audit.service";
import type { IOpportunityRepository, OpportunityRecord } from "../../domain/opportunity.repository";

export const OPEN_STAGES = ["PROSPECTO", "CONTACTO", "PROPUESTA", "NEGOCIACION"];
export const TERMINAL_STAGES = ["GANADA", "PERDIDA"];

export interface UpdateOpportunityStageInput {
  opportunityId: string;
  stage: string;
  lostReason?: string;
}

/**
 * Mueve una oportunidad entre etapas abiertas (libremente, adelante o atras) o la marca PERDIDA
 * (exige lostReason). Ganar NO pasa por aqui -- es el unico camino que crea una Sale real, ver
 * CloseOpportunityAsWonUseCase.
 */
export class UpdateStageUseCase {
  constructor(private readonly repo: IOpportunityRepository, private readonly audit: AuditService) {}

  async execute(input: UpdateOpportunityStageInput): Promise<OpportunityRecord> {
    const opportunity = await this.repo.findByIdOrThrow(input.opportunityId);

    if (TERMINAL_STAGES.includes(opportunity.stage)) {
      throw new ValidationError("Una oportunidad cerrada (ganada o perdida) no puede cambiar de etapa");
    }
    if (input.stage === "GANADA") {
      throw new ValidationError("Para ganar una oportunidad use POST /opportunities/:id/win, que la convierte en venta");
    }
    if (input.stage === "PERDIDA") {
      if (!input.lostReason || input.lostReason.trim().length === 0) {
        throw new ValidationError("Debe indicar el motivo al marcar una oportunidad como perdida");
      }
    } else if (!OPEN_STAGES.includes(input.stage)) {
      throw new ValidationError(`Etapa invalida: ${input.stage}`);
    }

    const updated = await this.repo.updateStage(opportunity.id, {
      stage: input.stage,
      lostReason: input.stage === "PERDIDA" ? input.lostReason : undefined,
      lostAt: input.stage === "PERDIDA" ? new Date() : undefined,
    });

    await this.audit.record({
      action: "OPPORTUNITY_STAGE_CHANGED",
      entityType: "Opportunity",
      entityId: opportunity.id,
      description: `Oportunidad "${opportunity.title}" paso de ${opportunity.stage} a ${input.stage}`,
      metadata: { fromStage: opportunity.stage, toStage: input.stage },
    });

    return updated;
  }
}
