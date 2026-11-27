import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { PostPayrollJournalEntryUseCase } from "../../../accounting/application/use-cases/post-payroll-journal-entry.use-case";
import type { IPayrollDeductionRepository } from "../../domain/payroll-deduction.repository";
import type { IPayrollRepository, PayrollRecord } from "../../domain/payroll.repository";
import type { SendPayslipWhatsAppUseCase } from "./send-payslip-whatsapp.use-case";
import type { IssueElectronicPayrollUseCase } from "./issue-electronic-payroll.use-case";
import { round2 } from "@erp/shared-utils";
import { payrollIncludesMonthCommissions, type IPayrollCommissionReader } from "../../domain/payroll-commission.reader";

const DEDUCTION_CONCEPT_CODES = new Set(["LOAN_DEDUCTION", "GARNISHMENT"]);

export class ApprovePayrollUseCase {
  constructor(
    private readonly repo: IPayrollRepository,
    private readonly deductionRepo: IPayrollDeductionRepository,
    private readonly postPayrollJournalEntry: PostPayrollJournalEntryUseCase,
    private readonly issueElectronicPayroll: IssueElectronicPayrollUseCase,
    private readonly sendPayslipWhatsApp: SendPayslipWhatsAppUseCase,
    private readonly audit: AuditService,
    private readonly commissionReader?: IPayrollCommissionReader
  ) {}

  async execute(id: string): Promise<PayrollRecord> {
    const payroll = await this.repo.findByIdOrThrow(id);
    if (payroll.status !== "CALCULATED") {
      throw new ValidationError(`Solo se puede aprobar una nomina en estado CALCULATED (actual: ${payroll.status})`);
    }

    // Comisiones: las del mes deben ser las mismas con que se calculo (si se recalcularon despues, hay que
    // recalcular la nomina); al aprobar quedan pagadas dentro de esta nomina.
    const commissionIds: string[] = [];
    if (this.commissionReader && payrollIncludesMonthCommissions(payroll)) {
      const before = await this.repo.findWithDetailsOrThrow(id);
      for (const detail of before.details) {
        const pending = await this.commissionReader.pendingForEmployee(detail.employeeId, payroll.year, payroll.month);
        const inPayroll = round2(detail.items.filter((i) => i.conceptCode === "COMMISSION").reduce((s, i) => s + i.amount, 0));
        if (round2(pending.reduce((s, c) => s + c.amount, 0)) !== inPayroll) {
          throw new ValidationError("Las comisiones del mes cambiaron despues de calcular la nomina: recalculela antes de aprobar");
        }
        commissionIds.push(...pending.map((c) => c.id));
      }
    }

    const updated = await this.repo.updateStatus(id, "APPROVED");
    await this.commissionReader?.markPaidInPayroll(commissionIds, id);

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
