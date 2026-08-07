export interface CollectionReminderNotification {
  customerName: string;
  customerEmail: string;
  saleNumber: number;
  amountDue: number;
  dueDate: Date;
  /** Positivo = antes de vencer, 0 = vence hoy, negativo = dias de mora. */
  daysBeforeDue: number;
}

/**
 * Puerto de envio del recordatorio de cobro (item 31). Puerto propio en vez de reusar
 * IReminderNotifier (saas-admin): ese port ya esta atado a SubscriptionReminderNotification
 * (companyName/planName/etc, ver su README) y su unica implementacion (ResendEmailNotifier)
 * tiene el asunto/HTML del correo hardcodeados a ese shape -- generalizarlo hubiera significado
 * tocar un flujo de facturacion SaaS ya probado por poco beneficio real. `send` debe LANZAR si
 * el envio falla, mismo contrato que IReminderNotifier: el caller
 * (RunCollectionsRemindersUseCase) solo marca el recordatorio como enviado
 * (AccountReceivableReminderLog) si `send` resuelve sin error.
 */
export interface ICollectionReminderNotifier {
  send(notification: CollectionReminderNotification): Promise<void>;
}
