import type { AuditService } from "../../../audit/application/audit.service";
import type { ICollectionReminderNotifier } from "../../domain/collection-reminder-notifier";
import type { IAccountReceivableRepository } from "../../domain/account-receivable.repository";
import type { ICustomerRepository } from "../../../customers/domain/customer.repository";
import type { ISaleRepository } from "../../../pos/sale/domain/sale.repository";
import type { IWhatsAppSender } from "../../../whatsapp/domain/whatsapp-sender.port";
import { normalizeToE164 } from "../../../whatsapp/application/normalize-phone";

/** Antes de vencer (3/1 dias y el dia mismo) y seguimiento de mora (3/7 dias vencido) -- valor
 * asumido, documentado igual que REMINDER_DAYS en run-subscription-lifecycle.use-case.ts. */
const REMINDER_DAYS = [3, 1, 0, -3, -7];

function buildWhatsAppMessage(customerName: string, saleNumber: number, amountDue: number, daysBeforeDue: number): string {
  const amount = amountDue.toLocaleString("es-CO");
  if (daysBeforeDue < 0) {
    return `Hola ${customerName}, tu factura #${saleNumber} por $${amount} esta vencida hace ${-daysBeforeDue} dias. Por favor ponte al dia.`;
  }
  if (daysBeforeDue === 0) {
    return `Hola ${customerName}, tu factura #${saleNumber} por $${amount} vence hoy.`;
  }
  return `Hola ${customerName}, tu factura #${saleNumber} por $${amount} vence en ${daysBeforeDue} dias.`;
}

function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

/**
 * Recorre las cuentas por cobrar PENDING/PARTIAL de la empresa actual (ver
 * IAccountReceivableRepository.listActive -- por eso este caso de uso corre UNA VEZ POR EMPRESA
 * dentro de tenantStorage.run, ver collections-reminder-poller.ts, a diferencia del poller de
 * suscripciones que hace una sola query cross-tenant porque Subscription no es tenant-scoped).
 * Mismo criterio de log solo-si-tuvo-exito que RunSubscriptionLifecycleUseCase: un fallo del
 * proveedor de correo deja el recordatorio pendiente para el siguiente ciclo, sin perderlo.
 */
export class RunCollectionsRemindersUseCase {
  constructor(
    private readonly accountReceivableRepo: IAccountReceivableRepository,
    private readonly customerRepo: ICustomerRepository,
    private readonly saleRepo: ISaleRepository,
    private readonly notifier: ICollectionReminderNotifier,
    private readonly whatsAppSender: IWhatsAppSender,
    private readonly audit: AuditService
  ) {}

  async execute(): Promise<void> {
    const receivables = await this.accountReceivableRepo.listActive();
    const now = new Date();

    for (const receivable of receivables) {
      const daysUntilDue = daysBetween(now, receivable.dueDate);
      if (!REMINDER_DAYS.includes(daysUntilDue)) continue;

      const alreadySent = await this.accountReceivableRepo.hasReminderLog(receivable.id, daysUntilDue);
      if (alreadySent) continue;

      try {
        const [customer, sale] = await Promise.all([
          this.customerRepo.findByIdOrThrow(receivable.customerId),
          this.saleRepo.findByIdOrThrow(receivable.saleId),
        ]);

        // Cascada: WhatsApp primero si hay telefono (mayor tasa de apertura), cae a email si
        // falla o no esta configurado (ver modules/whatsapp/README.md) -- nunca bloquea, mismo
        // criterio de reintento en el siguiente ciclo del poller si ambos fallan.
        let channelUsed: "WHATSAPP" | "EMAIL" | null = null;
        let recipient = "";
        if (customer.phone) {
          try {
            recipient = normalizeToE164(customer.phone);
            await this.whatsAppSender.sendText(
              recipient,
              buildWhatsAppMessage(customer.name, sale.number, receivable.balance, daysUntilDue)
            );
            channelUsed = "WHATSAPP";
          } catch {
            channelUsed = null;
          }
        }

        if (!channelUsed) {
          if (!customer.email) {
            throw new Error(`El cliente ${customer.name} no tiene email registrado (y WhatsApp no esta disponible)`);
          }
          await this.notifier.send({
            customerName: customer.name,
            customerEmail: customer.email,
            saleNumber: sale.number,
            amountDue: receivable.balance,
            dueDate: receivable.dueDate,
            daysBeforeDue: daysUntilDue,
          });
          channelUsed = "EMAIL";
          recipient = customer.email;
        }

        await this.accountReceivableRepo.createReminderLog(receivable.id, daysUntilDue, channelUsed);
        await this.audit.record({
          action: "COLLECTION_REMINDER_SENT",
          entityType: "AccountReceivable",
          entityId: receivable.id,
          description: `Recordatorio de cobro enviado por ${channelUsed} (${daysUntilDue} dias) a ${recipient}`,
        });
      } catch (err) {
        await this.audit.record({
          action: "COLLECTION_REMINDER_FAILED",
          entityType: "AccountReceivable",
          entityId: receivable.id,
          description: `No se pudo enviar el recordatorio de cobro (${daysUntilDue} dias): ${(err as Error).message}`,
        });
      }
    }
  }
}
