import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { PostPayrollJournalEntryUseCase } from "../../../accounting/application/use-cases/post-payroll-journal-entry.use-case";
import type { GenerateElectronicPayrollUseCase } from "../../../electronic-invoicing/application/use-cases/generate-electronic-payroll.use-case";
import type { IPayrollRepository, PayrollRecord } from "../../domain/payroll.repository";

export class ApprovePayrollUseCase {
  constructor(
    private readonly repo: IPayrollRepository,
    private readonly postPayrollJournalEntry: PostPayrollJournalEntryUseCase,
    private readonly generateElectronicPayroll: GenerateElectronicPayrollUseCase,
    private readonly audit: AuditService
  ) {}

  async execute(id: string): Promise<PayrollRecord> {
    const payroll = await this.repo.findByIdOrThrow(id);
    if (payroll.status !== "CALCULATED") {
      throw new ValidationError(`Solo se puede aprobar una nomina en estado CALCULATED (actual: ${payroll.status})`);
    }

    const updated = await this.repo.updateStatus(id, "APPROVED");

    await this.audit.record({
      action: "PAYROLL_APPROVED",
      entityType: "Payroll",
      entityId: updated.id,
      description: `Nomina aprobada: ${updated.month}/${updated.year}`,
    });

    const withDetails = await this.repo.findWithDetailsOrThrow(id);
    await this.postPayrollJournalEntry.execute({
      payrollId: updated.id,
      year: updated.year,
      month: updated.month,
      endDate: updated.endDate,
      details: withDetails.details.map((d) => ({
        grossTotal: d.grossTotal,
        netPay: d.netPay,
        totalDeductions: d.totalDeductions,
        items: d.items.map((i) => ({ conceptCode: i.conceptCode, amount: i.amount })),
      })),
    });

    // La DIAN genera nomina electronica POR EMPLEADO POR PERIODO, no una sola vez por la corrida
    // completa -- un empleado fallando no debe frenar a los demas ni bloquear la aprobacion
    // (mismo criterio no bloqueante que ventas/notas/compras).
    for (const detail of withDetails.details) {
      try {
        await this.generateElectronicPayroll.execute({
          payrollDetailId: detail.id,
          employeeId: detail.employeeId,
          periodStart: updated.startDate,
          periodEnd: updated.endDate,
          grossTotal: detail.grossTotal,
          totalDeductions: detail.totalDeductions,
          netPay: detail.netPay,
          items: detail.items.map((i) => ({ conceptCode: i.conceptCode, amount: i.amount })),
        });
      } catch (err) {
        await this.audit.record({
          action: "ELECTRONIC_PAYROLL_GENERATION_FAILED",
          entityType: "PayrollDetail",
          entityId: detail.id,
          description: `No se pudo generar la nomina electronica del empleado ${detail.employeeId}: ${(err as Error).message}`,
          metadata: {},
        });
      }
    }

    return updated;
  }
}
