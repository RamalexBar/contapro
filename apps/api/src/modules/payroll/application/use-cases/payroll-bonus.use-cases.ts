import type { CreatePayrollBonusInput } from "@erp/shared-types";
import { round2 } from "@erp/shared-utils";
import { getTenantContext } from "../../../../shared/context/request-context";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IEmployeeRepository } from "../../../employees/domain/employee.repository";
import type { IPayrollBonusRepository, PayrollBonusRecord } from "../../domain/payroll-bonus.repository";

/** Registra una bonificacion no salarial; entra en la nomina cuyo periodo contiene la fecha. */
export class CreatePayrollBonusUseCase {
  constructor(
    private readonly repo: IPayrollBonusRepository,
    private readonly employeeRepo: IEmployeeRepository,
    private readonly audit: AuditService
  ) {}

  async execute(input: CreatePayrollBonusInput): Promise<PayrollBonusRecord> {
    const employee = await this.employeeRepo.findByIdOrThrow(input.employeeId);
    // Vale cualquier fecha dentro del contrato: un retirado puede recibirla en su ultima nomina.
    const day = input.date.toISOString().slice(0, 10);
    if (day < employee.hireDate.toISOString().slice(0, 10)) {
      throw new ValidationError("La fecha de la bonificacion es anterior al ingreso del empleado");
    }
    if (employee.terminationDate && day > employee.terminationDate.toISOString().slice(0, 10)) {
      throw new ValidationError("La fecha de la bonificacion es posterior al retiro del empleado");
    }

    const bonus = await this.repo.create({
      employeeId: input.employeeId,
      date: input.date,
      amount: round2(input.amount),
      description: input.description.trim(),
      createdByUserId: getTenantContext().userId,
    });
    if (await this.repo.isInClosedPayroll(bonus)) {
      await this.repo.cancel(bonus.id);
      throw new ValidationError("La nomina de esa fecha ya esta aprobada: registre la bonificacion con una fecha del periodo abierto");
    }

    await this.audit.record({
      action: "PAYROLL_BONUS_CREATED",
      entityType: "PayrollBonus",
      entityId: bonus.id,
      description: `Bonificacion no salarial para ${employee.firstName} ${employee.lastName}: ${bonus.description} (${bonus.amount})`,
    });
    return bonus;
  }
}

export class ListPayrollBonusesUseCase {
  constructor(private readonly repo: IPayrollBonusRepository) {}

  execute(filter: { employeeId?: string }): Promise<PayrollBonusRecord[]> {
    return this.repo.list(filter);
  }
}

export class CancelPayrollBonusUseCase {
  constructor(private readonly repo: IPayrollBonusRepository, private readonly audit: AuditService) {}

  async execute(id: string): Promise<PayrollBonusRecord> {
    const bonus = await this.repo.findByIdOrThrow(id);
    if (bonus.status !== "ACTIVE") throw new ValidationError("La bonificacion ya esta cancelada");
    if (await this.repo.isInClosedPayroll(bonus)) {
      throw new ValidationError("La bonificacion ya se pago en una nomina aprobada y no se puede cancelar");
    }
    const cancelled = await this.repo.cancel(id);
    await this.audit.record({
      action: "PAYROLL_BONUS_CANCELLED",
      entityType: "PayrollBonus",
      entityId: id,
      description: `Bonificacion cancelada: ${cancelled.description} (${cancelled.amount})`,
    });
    return cancelled;
  }
}
