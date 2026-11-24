import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { GenerateElectronicPayrollUseCase } from "../../../electronic-invoicing/application/use-cases/generate-electronic-payroll.use-case";
import type { ResubmitElectronicPayrollUseCase } from "../../../electronic-invoicing/application/use-cases/resubmit-electronic-payroll.use-case";
import type { IPayrollRepository } from "../../domain/payroll.repository";
import { buildMonthlyElectronicPayrolls } from "../monthly-electronic-payroll";

export interface IssueElectronicPayrollResult {
  /** false = el mes todavia no esta completo (falta aprobar alguna nomina o la que llega a fin de mes). */
  monthComplete: boolean;
  /** Generados y enviados (con Factus, autorizados al instante; por envio directo quedan en cola). */
  sent: number;
  /** Rechazados o con error: el motivo queda en Auditoria. */
  failed: number;
  /** Ya estaban autorizados de antes. */
  alreadyAccepted: number;
}

/**
 * Nomina electronica del mes: un documento por empleado (Res. DIAN 000013 de 2021), sumando las
 * quincenas. Se llama al aprobar una nomina (solo emite si el mes ya quedo completo) y desde el boton
 * "Emitir nomina electronica" para reintentar (ej. despues de cargar el codigo DANE de la empresa).
 * Los documentos rechazados o sin enviar se reenvian; los autorizados no se tocan.
 */
export class IssueElectronicPayrollUseCase {
  constructor(
    private readonly repo: IPayrollRepository,
    private readonly generate: GenerateElectronicPayrollUseCase,
    private readonly resubmit: ResubmitElectronicPayrollUseCase,
    private readonly audit: AuditService
  ) {}

  /** Desde el boton: la nomina tiene que estar aprobada. */
  async execute(payrollId: string): Promise<IssueElectronicPayrollResult> {
    const payroll = await this.repo.findByIdOrThrow(payrollId);
    if (payroll.status !== "APPROVED" && payroll.status !== "PAID") {
      throw new ValidationError("La nomina electronica se emite despues de aprobar la nomina");
    }
    return this.issueMonth(payroll.year, payroll.month);
  }

  async issueMonth(year: number, month: number): Promise<IssueElectronicPayrollResult> {
    const result: IssueElectronicPayrollResult = { monthComplete: false, sent: 0, failed: 0, alreadyAccepted: 0 };
    const monthly = buildMonthlyElectronicPayrolls(year, month, await this.repo.listMonthWithDetails(year, month));
    if (!monthly) return result;
    result.monthComplete = true;

    for (const employee of monthly) {
      try {
        const issued = await this.generate.findIssued(employee.employeeId, year, month);
        if (issued?.status === "ACCEPTED") {
          result.alreadyAccepted++;
          continue;
        }
        // Envio directo: ya esta en la cola de la DIAN.
        if (issued?.status === "PENDING_SUBMISSION") {
          result.sent++;
          continue;
        }
        if (issued) {
          await this.resubmit.execute(issued.payrollDetailId);
          result.sent++;
          continue;
        }
        const doc = await this.generate.execute({ ...employee, year, month });
        if (doc.status === "REJECTED") result.failed++;
        else result.sent++;
      } catch (err) {
        result.failed++;
        await this.audit.record({
          action: "ELECTRONIC_PAYROLL_GENERATION_FAILED",
          entityType: "PayrollDetail",
          entityId: employee.payrollDetailId,
          description: `No se pudo emitir la nomina electronica de ${month}/${year} del empleado ${employee.employeeId}: ${(err as Error).message}`,
          metadata: {},
        });
      }
    }
    return result;
  }
}
