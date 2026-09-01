# Modulo: Cobranza (cuentas por cobrar)

Estado: **cuentas por cobrar generadas automaticamente desde ventas a credito, cobro en persona
(abono) y en linea (link de pago Wompi + webhook), y recordatorios automaticos de cobro por
correo, todo implementado.** Item 31 de `docs/ALCANCE.md` ("Brecha funcional vs. Alegra/Siigo").

## El hallazgo que simplifico todo el diseño

El mecanismo de "venta a credito" **ya existia, pero estaba inerte**: `salePaymentInputSchema`
(modulo `pos/sale`) ya acepta `method: "CREDIT"`, `CreateSaleUseCase` ya cuenta ese monto como
pago valido (satisface la validacion de que los pagos cubran el total, sin que se haya cobrado
nada real), y `PostSaleJournalEntryUseCase` ya lo contabiliza correctamente como debito a
`1305 Clientes`. Lo unico que faltaba era **estructura sobre ese mecanismo**: nada registraba
quien debia, cuanto y para cuando, ni existia forma de cobrarlo despues. Por eso este item **no
tuvo que tocar la validacion de `CreateSaleUseCase`** -- solo enganchar sobre el `CREDIT` que ya
existia.

## Por que no se reactivo `Customer.currentBalance`/`CustomerCreditMovement`/`CustomerPayment`

Esos tres campos/modelos ya existian en el schema original pero **sin ningun codigo que los
usara** (ni repositorio, ni caso de uso, ni controlador -- `currentBalance` se guardaba en cero
para siempre). Decision: no reactivarlos, construir `AccountReceivable`/`AccountReceivablePayment`
nuevos que mirrorean exactamente `AccountPayable`/`SupplierPayment` (modulo `suppliers`, patron ya
probado dos veces), en vez de heredar suposiciones de codigo nunca ejercitado.

## Modelos (`packages/database/prisma/schema/collections.prisma`)

- `AccountReceivable` -- `customerId`, `saleId` (FK `@unique`, una venta genera a lo sumo una),
  `amount`/`balance`, `dueDate` (30 dias por defecto si la venta no especifica uno, ver
  `resolve-receivable-input.ts` en `pos/sale`), `status` (`PENDING`/`PARTIAL`/`PAID`/`CANCELLED`).
- `AccountReceivablePayment` -- `method` (`CASH`/`CARD`/`TRANSFER`/`WOMPI`), `status`
  (`PENDING` solo para pagos en linea esperando webhook, `REGISTERED`, `FAILED`), `reference`
  unica (solo pagos en linea). **A proposito NO tiene columna `companyId` propia** (se protege
  via su `AccountReceivable` padre, mismo criterio que `SupplierPayment`/`SaleItem`) -- un primer
  intento la agrego a `TENANT_MODELS` de todas formas, lo que hacia que la extension de tenant
  intentara inyectarle un `companyId` inexistente y Prisma rechazara cualquier `create()`; se
  encontro y corrigio en la verificacion en vivo, al registrar el primer abono (ver
  `tenant.extension.ts`).
- `AccountReceivableReminderLog` -- deduplicacion de recordatorios, `@@unique([accountReceivableId, daysBeforeDue])`, mismo patron que `SubscriptionReminderLog`.

## Implementado

1. **Generacion automatica de la cuenta por cobrar**: `CreateSaleUseCase`/`AuthorizeDiscountUseCase`
   (modulo `pos/sale`) llaman a `resolveReceivableInput(payments, customerId, dueDate)` -- suma los
   pagos `CREDIT`, exige `customerId` si el monto es mayor a cero, resuelve `dueDate` (input
   opcional en `POST /sales`, default +30 dias). Se crea dentro de la MISMA transaccion que
   `PrismaSaleRepository.create()` (igual que `AccountPayable` dentro de
   `PrismaPurchaseRepository.create()`) cuando la venta se completa de una vez; si la venta
   necesito autorizacion de descuento, se crea recien al completarse en `AuthorizeDiscountUseCase`.
   El `dueDate` pedido al vender (si lo hubo) se guarda mientras tanto en
   `Sale.requestedReceivableDueDate` (`Sale` no tiene una columna `dueDate` operativa propia, solo
   este campo para la solicitud pendiente) y se reusa ahi -- solo si el cajero no pidio ningun
   plazo especifico cae en el default de 30 dias, contado desde el momento de la autorizacion.
2. **Cancelacion de una venta a credito** (`CancelSaleUseCase`): si la `AccountReceivable` no
   tiene ningun pago registrado, se cancela junto con la venta; si ya tiene un pago (en persona o
   confirmado en linea), la cancelacion se **rechaza** (422) -- mismo criterio de guarda que
   `CancelPurchaseUseCase` con `AccountPayable`, sin reversar automaticamente.
3. **Abono en persona**: `POST /accounts-receivable/:id/payments` (permiso `collection.manage`) --
   calco de `RegisterSupplierPaymentUseCase`: crea el pago ya `REGISTERED`, decrementa `balance`,
   contabiliza con `PostReceivableCollectionJournalEntryUseCase` (modulo `accounting`, nuevo):
   debito Caja (`CASH`) o Bancos (cualquier otro metodo), credito `1305 Clientes` -- espejo exacto
   de `PostSupplierPaymentJournalEntryUseCase`.
4. **Cobro en linea (Wompi)**: `POST /accounts-receivable/:id/checkout` genera el link de pago
   llamando directo a `IPaymentGateway.buildCheckoutUrl` (modulo `saas-admin`, la MISMA instancia
   que ya usa `billing`/`saas-admin` para cobrar suscripciones -- el port ya es generico,
   `reference`/`amountInCents`/`customerEmail`, no hizo falta tocarlo). Exige que el cliente tenga
   `email` registrado (`Customer.email` se guardaba desde el alta pero **ningun caso de uso lo
   leia hasta este item** -- se agrego a `CustomerRecord`/`ICustomerRepository`). Crea un
   `AccountReceivablePayment` en `PENDING` con `reference` unica (`ar-<id>-<timestamp>-<random>`).
5. **Webhook de Wompi — ruta propia, no comparte la de suscripciones**:
   `POST /collections/webhooks/wompi` (publico, sin `tenantContextMiddleware` -- Wompi no manda
   JWT), montado en `app.ts` **antes** que los routers tenant-scoped (mismo motivo que
   `saasAdminRouter`). `ConfirmReceivableWompiPaymentUseCase` busca el pago por `reference` con
   `basePrisma` directo (`findPaymentByReferenceCrossTenant`, sin contexto de tenant -- mismo
   motivo que `Subscription` en `saas-admin`) y, una vez conocido el `companyId`, envuelve el
   resto (confirmar el pago, contabilizar) en `tenantStorage.run(...)` -- mismo truco que ya usa
   `dian-submission-poller.ts` para correr codigo tenant-scoped fuera de un request HTTP.
   Verificado en vivo con un evento `transaction.updated` firmado a mano con las llaves de sandbox
   (mismo criterio que la verificacion existente de Wompi en `saas-admin`): el saldo bajo a 0 y
   quedo `PAID`.
6. **Recordatorios automaticos** (`RunCollectionsRemindersUseCase` + `startCollectionsReminderPoller`):
   umbrales `[3, 1, 0, -3, -7]` dias respecto a `dueDate` (antes de vencer, el dia, y seguimiento
   de mora a 3/7 dias -- valor asumido, documentado). A diferencia del poller de suscripciones
   (una sola query cross-tenant porque `Subscription` no es tenant-scoped),
   `AccountReceivable` SI lo es -- este poller sigue el patron del poller de DIAN: itera las
   empresas activas y corre el caso de uso una vez POR EMPRESA dentro de
   `tenantStorage.run({ userId: "system", ... })`. Log de deduplicacion solo se escribe si el
   envio tuvo exito (mismo criterio que `SubscriptionReminderLog`) -- un fallo dado dueDate
   pendiente para el siguiente ciclo, sin perderse. Gateado por `RESEND_API_KEY` presente (mismo
   criterio que el poller de DIAN con su certificado). **Puerto de notificacion propio**
   (`ICollectionReminderNotifier`/`ResendCollectionReminderNotifier`), no reusa el
   `IReminderNotifier` de `saas-admin` -- ese port ya esta atado al shape de suscripciones
   (`companyName`/`planName`) y su unica implementacion tiene el asunto/HTML del correo
   hardcodeados a eso; generalizarlo hubiera significado tocar un flujo de facturacion SaaS ya
   probado por poco beneficio real. Verificado en vivo end-to-end (sin `RESEND_API_KEY`
   configurado en este entorno, igual que el resto de integraciones de correo del repo): se forzo
   el `dueDate` de una cuenta a hoy y se corrio el caso de uso directo (no se probo esperando el
   `setInterval`) -- genero `COLLECTION_REMINDER_FAILED` en la auditoria con el mensaje esperado,
   y una segunda corrida repitio el intento (confirma que no se escribio el log de deduplicacion
   tras el fallo, listo para reintentar). **El envio real contra Resend no esta probado**, mismo
   aviso que el resto de integraciones de correo del repo. **Item 41** (`docs/ALCANCE.md`,
   `modules/whatsapp`): `RunCollectionsRemindersUseCase` ahora intenta WhatsApp primero cuando
   `Customer.phone` esta registrado, cae a email si falla o no esta configurado -- mismo criterio
   de cascada en `saas-admin`. `AccountReceivableReminderLog.channel` guarda `"WHATSAPP"` cuando
   ese fue el canal que funciono (campo ya era texto libre, sin migracion).
7. Permisos nuevos `collection.manage`/`collection.read` (otorgados a `CONTADOR` y `SUPERVISOR`,
   no a `CAJERO`/`EMPLEADO` -- mismo criterio que `suppliers.*`/`expense.*`).
8. UI web (`/collections`, permiso `collection.read` en el nav): tabla de cuentas por cobrar con
   botones "Abonar" y "Generar link de pago". `POSPage.tsx`: selector de metodo de pago
   (Efectivo/A credito) -- a credito exige cliente y permite fecha de vencimiento opcional.

Verificado en vivo end-to-end contra Postgres local: venta a credito (comprobante balanceado,
`AccountReceivable` creada correcta), abono manual (saldo decrece, comprobante correcto), checkout
Wompi (firma/monto/email correctos), webhook simulado confirma el pago restante (saldo en 0,
segundo comprobante), cancelacion de una venta a credito sin abonos (cancela tambien la cuenta),
cancelacion rechazada cuando ya tiene un abono, `CAJERO` recibe 403 (no tiene `collection.read`
por defecto), recordatorio (logica verificada con el flujo de fallo esperado dado que Resend no
esta configurado en este entorno).

## Que falta implementar

1. Envio real de recordatorios contra una cuenta de Resend real (no probado, ver punto 6 arriba).
2. Webhook de Wompi contra un pago real de sandbox por navegador (aqui solo se probo con un evento
   firmado a mano, mismo alcance que la verificacion existente de Wompi en `saas-admin`).
3. Documento soporte / facturacion electronica no lleva ninguna mencion de que una venta se pago
   (parcialmente) a credito -- fuera de alcance de este item.
