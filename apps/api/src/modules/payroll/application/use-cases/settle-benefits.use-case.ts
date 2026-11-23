import { randomUUID } from "node:crypto";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { PostBenefitSettlementJournalEntryUseCase } from "../../../accounting/application/use-cases/post-benefit-settlement-journal-entry.use-case";
import type { EmployeeRecord, IEmployeeRepository } from "../../../employees/domain/employee.repository";
import type { BenefitSettlementRecord, BenefitSettlementType, IBenefitSettlementRepository } from "../../domain/benefit-settlement.repository";
import type { IPayrollParameterRepository } from "../../domain/payroll-parameter.repository";
import {
  buildSettlement,
  indemnityLine,
  serviceBonusLine,
  settlementWithholding,
  severanceLines,
  vacationLine,
  type BenefitLine,
  type EmployeeSettlement,
  type TerminationReason,
} from "../benefit-settlement-calculator";

export type SettleBenefitsInput =
  | { type: "SERVICE_BONUS"; year: number; semester: 1 | 2 }
  | { type: "SEVERANCE"; year: number }
  | { type: "TERMINATION"; employeeId: string; reason: TerminationReason; fixedTermEndDate?: Date };

export interface SettleBenefitsPreview {
  type: BenefitSettlementType;
  periodStart: Date;
  periodEnd: Date;
  description: string;
  settlements: EmployeeSettlement[];
  /** Empleados que no entran y por que (ya pagado, salario integral, etc.). */
  skipped: Array<{ employeeName: string; reason: string }>;
  terminationReason: TerminationReason | null;
}

const REASON_LABELS: Record<TerminationReason, string> = {
  RESIGNATION: "Renuncia voluntaria",
  JUST_CAUSE: "Despido con justa causa",
  WITHOUT_JUST_CAUSE: "Despido sin justa causa",
  END_OF_TERM: "Terminacion del plazo pactado",
  MUTUAL_AGREEMENT: "Mutuo acuerdo",
};

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const fullName = (e: EmployeeRecord) => `${e.firstName} ${e.lastName}`;

/**
 * Prima de servicios, consolidacion de cesantias y liquidacion del contrato (ver
 * benefit-settlement-calculator.ts). `preview` no guarda nada; `execute` guarda una fila por
 * empleado, contabiliza un solo comprobante para el lote y no deja pagar dos veces el mismo periodo.
 */
export class SettleBenefitsUseCase {
  constructor(
    private readonly repo: IBenefitSettlementRepository,
    private readonly employeeRepo: IEmployeeRepository,
    private readonly parameterRepo: IPayrollParameterRepository,
    private readonly postJournalEntry: PostBenefitSettlementJournalEntryUseCase,
    private readonly audit: AuditService
  ) {}

  async preview(input: SettleBenefitsInput): Promise<SettleBenefitsPreview> {
    if (input.type === "TERMINATION") return this.previewTermination(input);
    return this.previewPeriodic(input);
  }

  async execute(input: SettleBenefitsInput): Promise<{ preview: SettleBenefitsPreview; records: BenefitSettlementRecord[] }> {
    const preview = await this.preview(input);
    if (preview.settlements.length === 0) {
      throw new ValidationError("No hay nada para liquidar en este periodo (revise la lista de empleados que no entran).");
    }

    const batchId = randomUUID();
    const entry = await this.postJournalEntry.execute({
      date: preview.periodEnd,
      description: preview.description,
      sourceId: batchId,
      settlements: preview.settlements.map((s) => ({
        lines: s.lines.map((l) => ({ concept: l.concept, amount: l.amount, provisioned: l.provisioned })),
        withholding: s.withholding,
        netPay: s.netPay,
        toSeveranceFund: s.toSeveranceFund,
      })),
    });

    const records = await this.repo.createMany(
      preview.settlements.map((settlement) => ({
        type: preview.type,
        periodStart: preview.type === "TERMINATION" ? preview.periodEnd : preview.periodStart,
        periodEnd: preview.periodEnd,
        settlement,
        terminationReason: preview.terminationReason,
      })),
      entry?.id ?? null
    );

    await this.audit.record({
      action: "BENEFIT_SETTLEMENT_POSTED",
      entityType: "BenefitSettlement",
      entityId: batchId,
      description: `${preview.description} (${records.length} empleado(s))`,
      metadata: { type: preview.type, employeeCount: records.length, journalEntryId: entry?.id ?? null },
    });

    return { preview, records };
  }

  private async previewPeriodic(input: Extract<SettleBenefitsInput, { type: "SERVICE_BONUS" | "SEVERANCE" }>): Promise<SettleBenefitsPreview> {
    const isBonus = input.type === "SERVICE_BONUS";
    const periodStart = isBonus ? utc(input.year, input.semester === 1 ? 1 : 7, 1) : utc(input.year, 1, 1);
    const periodEnd = isBonus ? (input.semester === 1 ? utc(input.year, 6, 30) : utc(input.year, 12, 31)) : utc(input.year, 12, 31);
    const description = isBonus
      ? `Prima de servicios ${input.semester === 1 ? "primer" : "segundo"} semestre ${input.year}`
      : `Consolidacion de cesantias e intereses ${input.year}`;
    const parameter = await this.parameterRepo.findByYearOrThrow(input.year);
    const employees = await this.employeeRepo.listActiveForPeriod(null, periodStart, periodEnd);

    const settlements: EmployeeSettlement[] = [];
    const skipped: SettleBenefitsPreview["skipped"] = [];
    for (const employee of employees) {
      if (employee.terminationDate && employee.terminationDate.getTime() <= periodEnd.getTime()) {
        skipped.push({ employeeName: fullName(employee), reason: "Se retiro en el periodo: se paga en su liquidacion de contrato" });
        continue;
      }
      if (employee.salaryType === "INTEGRAL") {
        skipped.push({ employeeName: fullName(employee), reason: "Salario integral: no tiene prima ni cesantias" });
        continue;
      }
      if (await this.repo.exists(employee.id, input.type, periodStart)) {
        skipped.push({ employeeName: fullName(employee), reason: "Ya se liquido este periodo" });
        continue;
      }
      const totals = await this.repo.approvedPayrollTotals(employee.id, periodStart, periodEnd);
      const lines: BenefitLine[] = isBonus
        ? [serviceBonusLine(employee, parameter, periodStart, periodEnd, totals)].filter((l): l is BenefitLine => l !== null)
        : severanceLines(employee, parameter, periodStart, periodEnd, totals);
      if (lines.length === 0) continue;
      const withholding = settlementWithholding(employee, parameter, lines, false);
      settlements.push(
        buildSettlement(employee, periodStart, periodEnd, lines, withholding, {
          severanceToFund: !isBonus,
          notes: isBonus
            ? ["Plazo de pago: 30 de junio (primer semestre) o 20 de diciembre (segundo semestre)."]
            : [
                "Cesantias: consignar al fondo del trabajador antes del 14 de febrero.",
                "Intereses: pagar al trabajador antes del 31 de enero.",
              ],
        })
      );
    }
    return { type: input.type, periodStart, periodEnd, description, settlements, skipped, terminationReason: null };
  }

  private async previewTermination(input: Extract<SettleBenefitsInput, { type: "TERMINATION" }>): Promise<SettleBenefitsPreview> {
    const employee = await this.employeeRepo.findByIdOrThrow(input.employeeId);
    const termination = employee.terminationDate;
    if (!termination) {
      throw new ValidationError("Primero dé de baja al empleado con su fecha de retiro (Empleados -> Dar de baja).");
    }
    if (await this.repo.exists(employee.id, "TERMINATION", termination)) {
      throw new ValidationError(`${fullName(employee)} ya tiene su liquidacion de contrato.`);
    }
    if (input.reason === "WITHOUT_JUST_CAUSE" && employee.contractType === "FIXED_TERM" && !input.fixedTermEndDate) {
      throw new ValidationError("Para un contrato a termino fijo despedido sin justa causa, indique la fecha en que terminaba el contrato.");
    }

    const year = termination.getUTCFullYear();
    const parameter = await this.parameterRepo.findByYearOrThrow(year);
    const yearStart = utc(year, 1, 1);
    const semesterStart = termination.getUTCMonth() < 6 ? utc(year, 1, 1) : utc(year, 7, 1);
    const notes: string[] = [
      `Motivo: ${REASON_LABELS[input.reason]}.`,
      "El salario de los ultimos dias trabajados se paga en la nomina del mes (ya va proporcional a la fecha de retiro).",
      "Plazo: pagar al terminar el contrato; el retraso genera la indemnizacion moratoria del art. 65 CST.",
    ];

    const lines: BenefitLine[] = [];
    if (await this.repo.exists(employee.id, "SEVERANCE", yearStart)) {
      notes.push("Las cesantias de este año ya se habian consolidado.");
    } else {
      lines.push(...severanceLines(employee, parameter, yearStart, termination, await this.repo.approvedPayrollTotals(employee.id, yearStart, termination)));
    }
    if (await this.repo.exists(employee.id, "SERVICE_BONUS", semesterStart)) {
      notes.push("La prima de este semestre ya se habia pagado.");
    } else {
      const bonus = serviceBonusLine(employee, parameter, semesterStart, termination, await this.repo.approvedPayrollTotals(employee.id, semesterStart, termination));
      if (bonus) lines.push(bonus);
    }
    const sinceHire = await this.repo.approvedPayrollTotals(employee.id, employee.hireDate, termination);
    const vacation = vacationLine(employee, termination, await this.repo.vacationDaysTaken(employee.id), sinceHire.provisions.VACATION ?? 0);
    if (vacation) lines.push(vacation);
    const indemnity = indemnityLine(employee, parameter, termination, input.reason, input.fixedTermEndDate ?? null);
    if (indemnity) lines.push(indemnity);

    const withholding = settlementWithholding(employee, parameter, lines, true);
    return {
      type: "TERMINATION",
      periodStart: employee.hireDate,
      periodEnd: termination,
      description: `Liquidacion de contrato: ${fullName(employee)}`,
      settlements: [buildSettlement(employee, employee.hireDate, termination, lines, withholding, { severanceToFund: false, notes })],
      skipped: [],
      terminationReason: input.reason,
    };
  }
}
