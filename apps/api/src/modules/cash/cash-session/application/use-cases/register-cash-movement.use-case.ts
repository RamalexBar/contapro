import type { CashMovementInput } from "@erp/shared-types";
import { getTenantContext } from "../../../../../shared/context/request-context";
import type { AuditService } from "../../../../audit/application/audit.service";
import type { ICashSessionRepository } from "../../domain/cash-session.repository";

/** Ingresos, egresos, retiros y consignaciones dentro de una sesion de caja abierta. */
export class RegisterCashMovementUseCase {
  constructor(private readonly repo: ICashSessionRepository, private readonly audit: AuditService) {}

  async execute(cashSessionId: string, input: CashMovementInput): Promise<{ id: string }> {
    const userId = getTenantContext().userId;
    const movement = await this.repo.registerMovement(cashSessionId, input.type, input.amount, input.concept, userId);
    await this.audit.record({
      action: "CASH_MOVEMENT_REGISTERED",
      entityType: "CashSession",
      entityId: cashSessionId,
      description: `${input.type} de ${input.amount}: ${input.concept}`,
    });
    return movement;
  }
}
