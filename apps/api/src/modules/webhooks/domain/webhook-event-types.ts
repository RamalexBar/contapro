/** Unico evento disponible en v1 (item 40 de docs/ALCANCE.md) -- agregar otro evento es una
 * llamada de una linea a webhookDispatcherService.dispatch() desde el caso de uso
 * correspondiente, mas agregarlo aqui. Ver README del modulo public-api para el detalle de
 * alcance. */
export const WEBHOOK_EVENT_TYPES = ["sale.created"] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];
