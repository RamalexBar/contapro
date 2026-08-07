# WhatsApp: envío de documentos + canal alterno de recordatorios (ítem 41 de docs/ALCANCE.md)

Antes de este ítem, WhatsApp no enviaba nada y **tampoco ningún documento se enviaba por ningún
canal** — el RIDE de una factura electrónica y el PDF del desprendible de nómina se generaban bajo
demanda (`GET .../pdf`), el usuario los descargaba manualmente. Los únicos dos flujos de
notificación automática eran recordatorios por email (`IReminderNotifier` en `saas-admin`,
`ICollectionReminderNotifier` en `collections`).

Este ítem agrega dos cosas:

1. **Envío de documentos por WhatsApp** — el RIDE de la factura al cliente justo al facturar
   electrónicamente una venta (`modules/electronic-invoicing`), y el desprendible de nómina al
   empleado al aprobar el período (`modules/payroll`). Funcionalidad nueva, no una extensión de
   algo que ya existía.
2. **WhatsApp como canal alterno** (con fallback automático a email) en los dos recordatorios que
   ya existían: vencimiento de suscripción (`saas-admin`) y cobranza (`collections`).
   `SubscriptionReminderLog.channel` ya documentaba `"WHATSAPP"` como valor válido sin usar — el
   schema fue diseñado anticipando este ítem.

## Limitación de entorno (misma categoría que DIAN/Wompi/Resend)

La WhatsApp Business Cloud API de Meta exige **verificación de negocio** y, para mensajes
iniciados por la empresa fuera de una ventana de 24h abierta por el cliente, **plantillas de
mensaje pre-aprobadas** — un proceso externo que no se puede completar en este entorno de
desarrollo. Se construyó la integración real (`fetch` directo a la Graph API de Meta, sin SDK,
mismo criterio que `dian-soap-client.ts`/`resend-email-notifier.ts`) pero **no está verificada
contra el servicio real**. El formato de los payloads sigue la documentación pública de Meta al
momento de escribir esto, sin confirmar contra una cuenta real.

En este entorno (sin `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` configurados), el
comportamiento observable es: el envío de documentos queda auditado como fallido
(`WHATSAPP_RIDE_SEND_FAILED`/`WHATSAPP_PAYSLIP_SEND_FAILED`, sin bloquear la venta/aprobación de
nómina), y los recordatorios caen automáticamente a email — **cero regresión** en el
comportamiento previo a este ítem.

## Arquitectura

- **Puerto genérico** `IWhatsAppSender` (`domain/whatsapp-sender.port.ts`): `sendText`/
  `sendDocument`. Implementado por `WhatsAppCloudApiSender` (`infrastructure/whatsapp-cloud-api-sender.ts`):
  `sendDocument` primero sube el buffer a `/media` (multipart, sin SDK) y luego envía un mensaje
  `type: "document"` referenciando el `media_id` devuelto.
- **Log de entregas** `WhatsAppDeliveryLog` — a diferencia de la mayoría de repos de este backend,
  **todos los métodos reciben `companyId` explícito** (nunca vía `getTenantContext()` ni la
  extensión automática de tenant, ver `tenant.extension.ts`). Motivo: se escribe tanto desde casos
  de uso tenant-scoped (factura, nómina, cobranza) como desde el poller de recordatorios de
  suscripción, que es **platform-level** y nunca corre dentro de un `AsyncLocalStorage` de tenant.
- Los casos de uso de envío específicos (`SendInvoiceWhatsAppUseCase`, `SendPayslipWhatsAppUseCase`)
  viven en sus módulos dueños (`electronic-invoicing`, `payroll`) e importan el puerto/log-repo
  desde `whatsapp.container.ts` — el módulo genérico nunca depende hacia atrás de un módulo de
  dominio, mismo patrón de reuso cross-módulo de toda la sesión.
- **Envío de documentos = "mejor esfuerzo", nunca bloquea el flujo que lo dispara**: `try/catch`
  alrededor de la llamada (dentro del caso de uso Y otra vez en el caller, como red de seguridad),
  éxito o fallo se audita y se registra en `WhatsAppDeliveryLog`. Si el cliente/empleado no tiene
  teléfono, o la venta no tiene cliente (consumidor final), se omite el intento sin más (no es un
  fallo, no genera fila de log).
- **Recordatorios = cascada con fallback automático a email**: si hay teléfono, se intenta
  WhatsApp primero (mayor tasa de apertura); si falla (incluida la falta de configuración) se cae
  a email igual que antes de este ítem. El log de recordatorio (`SubscriptionReminderLog`/
  `AccountReceivableReminderLog`) sigue guardando un solo registro por umbral, con `channel` = el
  canal que sí funcionó — sin migración de schema, `channel` ya era texto libre en ambas tablas.
- **Normalización de teléfono best-effort** (`application/normalize-phone.ts`): heurística, no
  validación formal — los campos `phone` del schema son texto libre sin formato exigido.

## Endpoints de reenvío manual

Sin permisos nuevos: `GET .../whatsapp-deliveries` + `POST .../whatsapp/resend` anidados en el
módulo dueño de cada documento, reusando el permiso que ya protege ese recurso:

| Ruta | Permiso |
|---|---|
| `GET /electronic-invoicing/sales/:saleId/whatsapp-deliveries` | `electronic-invoicing.read` |
| `POST /electronic-invoicing/sales/:saleId/whatsapp/resend` | `electronic-invoicing.manage` |
| `GET /payslips/:id/whatsapp-deliveries` | `payroll.read` |
| `POST /payslips/:id/whatsapp/resend` | `payroll.approve` |

UI: badge de estado + botón "Reenviar" (si falló) debajo de la confirmación de venta en `/pos` y
junto al botón "Desprendible PDF" en `/payroll`.

## Variables de entorno

`WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` (vacíos por defecto = envío deshabilitado,
mismo criterio que `DIAN_*`/`RESEND_*`/`WOMPI_*`), `WHATSAPP_API_VERSION` (default `v21.0`).

## Fuera de alcance (documentado explícitamente)

1. **Sin verificación contra el servicio real de Meta** — bloqueado por verificación de negocio +
   plantillas pre-aprobadas, proceso externo no completable en este entorno.
2. **Sin más eventos de documento** más allá de RIDE de venta y desprendible de nómina — agregar
   otro (ej. RIDE de nota crédito) es una llamada de una línea al mismo patrón.
3. **Sin cola de reintentos automáticos** — cada intento fallido queda registrado con un botón
   "reenviar" manual en la UI, mismo criterio que los webhooks salientes (ítem 40).
4. **Sin validación de formato de teléfono** — `normalizeToE164` es una heurística best-effort, no
   una validación formal.
