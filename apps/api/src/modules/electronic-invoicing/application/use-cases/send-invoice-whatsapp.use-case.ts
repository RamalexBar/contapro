import { getTenantContext } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { ICustomerRepository } from "../../../customers/domain/customer.repository";
import { normalizeToE164 } from "../../../whatsapp/application/normalize-phone";
import type { IWhatsAppSender } from "../../../whatsapp/domain/whatsapp-sender.port";
import type { IWhatsAppDeliveryLogRepository } from "../../../whatsapp/domain/whatsapp-delivery-log.repository";
import { mapInvoiceToRideData } from "../ride-data-mapper";
import { renderRidePdf } from "../../infrastructure/pdfkit-ride-renderer";
import type { GetElectronicInvoiceUseCase } from "./get-electronic-invoice.use-case";

export interface SendInvoiceWhatsAppInput {
  saleId: string;
  customerId: string | null;
}

/**
 * Envio del RIDE de la factura electronica al cliente por WhatsApp -- "mejor esfuerzo", nunca
 * lanza (mismo criterio que WebhookDispatcherService.dispatch): si no hay cliente o el cliente no
 * tiene telefono, no hay nada que intentar y se sale en silencio (no es un fallo, no genera fila
 * de log). Si hay intento, siempre queda registrado en WhatsAppDeliveryLog + auditado, exito o
 * fallo. Ver modules/whatsapp/README.md para el estado real de esta integracion (sin verificar
 * contra la API de Meta).
 */
export class SendInvoiceWhatsAppUseCase {
  constructor(
    private readonly customerRepo: ICustomerRepository,
    private readonly getInvoiceUseCase: GetElectronicInvoiceUseCase,
    private readonly whatsAppSender: IWhatsAppSender,
    private readonly deliveryLogRepo: IWhatsAppDeliveryLogRepository,
    private readonly audit: AuditService
  ) {}

  async execute(input: SendInvoiceWhatsAppInput): Promise<void> {
    if (!input.customerId) return;

    const customer = await this.customerRepo.findByIdOrThrow(input.customerId);
    if (!customer.phone) return;

    const companyId = getTenantContext().companyId;
    const recipientPhone = normalizeToE164(customer.phone);

    try {
      const invoice = await this.getInvoiceUseCase.execute(input.saleId);
      const pdf = await renderRidePdf(mapInvoiceToRideData(invoice));
      await this.whatsAppSender.sendDocument(recipientPhone, {
        buffer: pdf,
        filename: `factura-${invoice.fullNumber}.pdf`,
        caption: `Factura electronica ${invoice.fullNumber}`,
      });

      await this.deliveryLogRepo.record({
        companyId,
        messageType: "SALE_INVOICE_RIDE",
        referenceId: input.saleId,
        recipientPhone,
        success: true,
      });
      await this.audit.record({
        action: "WHATSAPP_RIDE_SENT",
        entityType: "Sale",
        entityId: input.saleId,
        description: `RIDE de la factura electronica enviado por WhatsApp a ${recipientPhone}`,
      });
    } catch (err) {
      const errorMessage = (err as Error).message;
      await this.deliveryLogRepo.record({
        companyId,
        messageType: "SALE_INVOICE_RIDE",
        referenceId: input.saleId,
        recipientPhone,
        success: false,
        errorMessage,
      });
      await this.audit.record({
        action: "WHATSAPP_RIDE_SEND_FAILED",
        entityType: "Sale",
        entityId: input.saleId,
        description: `No se pudo enviar el RIDE por WhatsApp a ${recipientPhone}: ${errorMessage}`,
      });
    }
  }
}
