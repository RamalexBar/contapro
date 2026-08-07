import { getTenantContext } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { IEmployeeRepository } from "../../../employees/domain/employee.repository";
import { normalizeToE164 } from "../../../whatsapp/application/normalize-phone";
import type { IWhatsAppSender } from "../../../whatsapp/domain/whatsapp-sender.port";
import type { IWhatsAppDeliveryLogRepository } from "../../../whatsapp/domain/whatsapp-delivery-log.repository";
import { mapToPayslipPdfData } from "../payslip-data-mapper";
import { renderPayslipPdf } from "../../infrastructure/pdfkit-payslip-renderer";
import type { ICompanyReader } from "../../domain/company-reader.repository";
import type { IPayrollRepository } from "../../domain/payroll.repository";

export interface SendPayslipWhatsAppInput {
  payslipId: string;
  employeeId: string;
}

/**
 * Envio del PDF del desprendible de pago al empleado por WhatsApp -- mismo criterio de "mejor
 * esfuerzo" que SendInvoiceWhatsAppUseCase (electronic-invoicing): si el empleado no tiene
 * telefono, no hay nada que intentar y se sale en silencio. Si hay intento, siempre queda
 * registrado en WhatsAppDeliveryLog + auditado, exito o fallo. Ver modules/whatsapp/README.md
 * para el estado real de esta integracion (sin verificar contra la API de Meta).
 */
export class SendPayslipWhatsAppUseCase {
  constructor(
    private readonly employeeRepo: IEmployeeRepository,
    private readonly payrollRepo: IPayrollRepository,
    private readonly companyReader: ICompanyReader,
    private readonly whatsAppSender: IWhatsAppSender,
    private readonly deliveryLogRepo: IWhatsAppDeliveryLogRepository,
    private readonly audit: AuditService
  ) {}

  async execute(input: SendPayslipWhatsAppInput): Promise<void> {
    const employee = await this.employeeRepo.findByIdOrThrow(input.employeeId);
    if (!employee.phone) return;

    const companyId = getTenantContext().companyId;
    const recipientPhone = normalizeToE164(employee.phone);

    try {
      const [payslip, company] = await Promise.all([
        this.payrollRepo.findPayslipByIdOrThrow(input.payslipId),
        this.companyReader.findByIdOrThrow(companyId),
      ]);
      const pdf = await renderPayslipPdf(mapToPayslipPdfData(payslip, employee, company));
      await this.whatsAppSender.sendDocument(recipientPhone, {
        buffer: pdf,
        filename: `desprendible-${input.payslipId}.pdf`,
        caption: `Desprendible de pago - ${employee.firstName} ${employee.lastName}`,
      });

      await this.deliveryLogRepo.record({
        companyId,
        messageType: "PAYSLIP",
        referenceId: input.payslipId,
        recipientPhone,
        success: true,
      });
      await this.audit.record({
        action: "WHATSAPP_PAYSLIP_SENT",
        entityType: "PayslipDocument",
        entityId: input.payslipId,
        description: `Desprendible enviado por WhatsApp a ${recipientPhone}`,
      });
    } catch (err) {
      const errorMessage = (err as Error).message;
      await this.deliveryLogRepo.record({
        companyId,
        messageType: "PAYSLIP",
        referenceId: input.payslipId,
        recipientPhone,
        success: false,
        errorMessage,
      });
      await this.audit.record({
        action: "WHATSAPP_PAYSLIP_SEND_FAILED",
        entityType: "PayslipDocument",
        entityId: input.payslipId,
        description: `No se pudo enviar el desprendible por WhatsApp a ${recipientPhone}: ${errorMessage}`,
      });
    }
  }
}
