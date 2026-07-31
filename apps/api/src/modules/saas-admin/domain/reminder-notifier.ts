export interface SubscriptionReminderNotification {
  companyName: string;
  companyEmail: string;
  planName: string;
  /** 8, 5, 3, 1 o 0 (0 = vence hoy). */
  daysBeforeDue: number;
  currentPeriodEnd: Date;
}

/**
 * Puerto de envio del recordatorio de vencimiento de suscripcion. `send` debe LANZAR si el envio
 * falla (mismo criterio que IDianClient en electronic-invoicing): el caller
 * (RunSubscriptionLifecycleUseCase) solo marca el recordatorio como enviado
 * (SubscriptionReminderLog) si `send` resuelve sin error, para poder reintentar en el siguiente
 * ciclo del poller si el proveedor de correo esta caido o mal configurado.
 */
export interface IReminderNotifier {
  send(notification: SubscriptionReminderNotification): Promise<void>;
}
