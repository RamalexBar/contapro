import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { PostPayrollJournalEntryUseCase } from "../../../accounting/application/use-cases/post-payroll-journal-entry.use-case";
import type { IPayrollDeductionRepository } from "../../domain/payroll-deduction.repository";
import type { IPayrollRepository, PayrollRecord } from "../../domain/payroll.repository";
import type { SendPayslipWhatsAppUseCase } from "./send-payslip-whatsapp.use-case";
import type { IssueElectronicPayrollUseCase } from "./issue-electronic-payroll.use-case";

const DEDUCTION_CONCEPT_CODES = new Set(["LOAN_DEDUCTION", "GARNISHMENT"]);

export class ApprovePayrollUseCase {
  constructor(
    private readonly repo: IPayrollRepository,
    private readonly deductionRepo: IPayrollDeductionRepository,
    private readonly postPayrollJournalEntry: PostPayrollJournalEntryUseCase,
    private readonly issueElectronicPayroll: IssueElectronicPayrollUseCase,
    private readonly sendPayslipWhatsApp: SendPayslipWhatsAppUseCase,
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

    // Descuenta el saldo de cada libranza/embargo aplicado (ver PayrollDeduction.applyPeriodAmount)
    // -- se hace AQUI, no al calcular, porque calcular es re-ejecutable (recalcular sobreescribe
    // el detalle anterior) y descontar ahi duplicaria el saldo en cada recalculo. Aprobar es el
    // punto sin retorno del periodo, igual que la contabilizacion y la nomina electronica de abajo.
    for (const detail of withDetails.details) {
      for (const item of detail.items) {
        if (item.payrollDeductionId && DEDUCTION_CONCEPT_CODES.has(item.conceptCode)) {
          await this.deductionRepo.applyPeriodAmount(item.payrollDeductionId, item.amount);
        }
      }
    }

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

    // Nomina electronica: solo si con esta aprobacion el mes quedo completo (ver IssueElectronicPayrollUseCase).
    await this.issueElectronicPayroll.issueMonth(updated.year, updated.month);

    for (const detail of withDetails.details) {
      // sendPayslipWhatsApp ya audita/registra exito y fallo internamente (nunca lanza por un
      // fallo de envio real) -- este try/catch es solo una red de seguridad, mismo criterio que
      // arriba. detail.payslip siempre existe en este punto (se genera en el paso "calcular").
      if (detail.payslip) {
        try {
          await this.sendPayslipWhatsApp.execute({ payslipId: detail.payslip.id, employeeId: detail.employeeId });
        } catch (err) {
          await this.audit.record({
            action: "WHATSAPP_PAYSLIP_SEND_FAILED",
            entityType: "PayslipDocument",
            entityId: detail.payslip.id,
            description: `No se pudo enviar el desprendible por WhatsApp del empleado ${detail.employeeId}: ${(err as Error).message}`,
            metadata: {},
          });
        }
      }
    }

    return updated;
  }

}
