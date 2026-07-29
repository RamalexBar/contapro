import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { PostPayrollJournalEntryUseCase } from "../../../accounting/application/use-cases/post-payroll-journal-entry.use-case";
import type { IPayrollRepository, PayrollRecord } from "../../domain/payroll.repository";

export class ApprovePayrollUseCase {
  constructor(
    private readonly repo: IPayrollRepository,
    private readonly postPayrollJournalEntry: PostPayrollJournalEntryUseCase,
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

    return updated;
  }
}
