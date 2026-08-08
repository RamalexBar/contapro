# Modulo: Panel Administrador SaaS

Estado: **implementado.** Autenticacion de plataforma separada, CRUD de planes y suscripciones,
cobro/renovacion, vista de empresas, dashboard agregado, poller de recordatorios/vencimiento/
suspension automatica (con envio real por correo), y UI web (`apps/web/src/features/platform-admin`).

## Modelos (`packages/database/prisma/schema/tenant.prisma`)

- `Plan` — planes de suscripcion (mensual/anual, limites de sucursales/usuarios, features).
- `Subscription` — suscripcion de cada empresa (`status`: TRIALING/ACTIVE/GRACE_PERIOD/
  SUSPENDED/CANCELLED, `currentPeriodEnd`, `graceEndsAt`).
- `SubscriptionPayment` — historial de pagos.
- `SubscriptionReminderLog` — registro de recordatorios enviados (8/5/3/1 dias antes + dia de
  vencimiento), para no reenviar duplicados (`@@unique([subscriptionId, daysBeforeDue])`).
- `PlatformAdmin` (nuevo) — operador de la plataforma, **sin relacion a ninguna Company**.
  Autenticacion completamente separada de `User` (ver seccion siguiente).

## Autenticacion de plataforma (separada de la de empresas)

El panel es transversal a todas las empresas: no usa `tenantContextMiddleware` (exige un
`companyId` de un JWT de usuario de empresa) ni `AsyncLocalStorage`. En su lugar:

- `POST /admin/auth/login` — login de `PlatformAdmin`, emite un JWT firmado con
  `JWT_PLATFORM_ADMIN_SECRET` (secreto **separado** de `JWT_ACCESS_SECRET` — un token de empresa
  nunca puede reusarse como token de plataforma ni viceversa).
- `requirePlatformAdmin` (`shared/middlewares/require-platform-admin.middleware.ts`) protege el
  resto de rutas: verifica el token y cuelga `res.locals.platformAdminId`.
- Todos los repositorios de este modulo usan `basePrisma` (no el cliente extendido) y filtran por
  `companyId` explicito cuando aplica — nunca por contexto implicito.
- **Importante sobre el orden de montaje en `app.ts`**: `saasAdminRouter` se monta ANTES que
  cualquier router tenant-scoped. Cada router tenant-scoped hace `.use(tenantContextMiddleware)`
  sin path, lo que intercepta **cualquier** request que le llegue (no solo sus propias rutas) y
  responde 401 antes de que Express siga probando routers posteriores. `/admin/*` es el primer
  caso de rutas genuinamente publicas/no-tenant montadas en esta cadena — de ahi que este orden
  importe (bug real encontrado y corregido durante este trabajo).
- Seed: `platform@demo.com` / `Demo1234!` (`packages/database/prisma/seed.ts`).

## Implementado

1. **Planes**: `POST/GET /admin/plans`, `PATCH /admin/plans/:id`. Sin auditoria (un `Plan` no
   pertenece a ninguna empresa, `AuditLog.companyId` es obligatorio).
2. **Suscripciones**: `POST/GET /admin/subscriptions`, `GET /admin/subscriptions/:id`. Al
   registrar una empresa (`RegisterCompanyUseCase`, `modules/auth`), se crea automaticamente una
   suscripcion `TRIALING` contra el plan `TRIAL` por **14 dias** — el spec original no especifica
   la duracion exacta del periodo de prueba, es un valor asumido y documentado como tal
   (`register-company.use-case.ts`).
3. **Cobro/renovacion**: `POST /admin/subscriptions/:id/payments` — crea el `SubscriptionPayment`
   (`CONFIRMED`), recalcula `currentPeriodEnd` con `calculateNextPeriodEnd`
   (`packages/shared-utils/src/dates.ts`) **desde la fecha de vencimiento ORIGINAL, nunca desde la
   fecha del pago** (el cliente no gana dias por pagar tarde dentro del periodo de gracia), limpia
   `graceEndsAt`, status vuelve a `ACTIVE`.
4. **Empresas**: `GET /admin/companies` — todas las `Company` con su suscripcion mas reciente.
5. **Dashboard**: `GET /admin/dashboard` — conteo de empresas por status, proximas a vencer en 8
   dias, ingresos confirmados del mes.
6. **Recordatorios y suspension automatica** (`RunSubscriptionLifecycleUseCase` +
   `infrastructure/subscription-lifecycle-poller.ts`, arrancado siempre desde `server.ts`,
   intervalo de 1 hora): envia un recordatorio real por correo en 8/5/3/1/0 dias antes del
   vencimiento (iteracion 17, ver seccion dedicada abajo), pasa a `GRACE_PERIOD` lo vencido
   (`graceEndsAt = currentPeriodEnd + 2 dias`, `calculateGraceEndsAt`) y a `SUSPENDED` lo que
   supero el periodo de gracia (sin borrar informacion).
7. Auditoria (donde hay `companyId` valido — no aplica a `Plan`): `SUBSCRIPTION_CREATED`,
   `SUBSCRIPTION_PAYMENT_REGISTERED`, `SUBSCRIPTION_STATUS_CHANGED`, `SUBSCRIPTION_REMINDER_SENT`,
   `SUBSCRIPTION_REMINDER_FAILED`.
8. **Cobro real via Wompi/Bancolombia** (iteracion 25, ver seccion dedicada abajo):
   `POST /admin/subscriptions/:id/checkout` genera un link de pago; el webhook
   `POST /admin/subscriptions/webhooks/wompi` (publico, sin `requirePlatformAdmin`) confirma el
   pago y renueva la suscripcion automaticamente, sin intervencion manual.

## Cobro real de suscripciones via Wompi/Bancolombia (iteracion 25)

`IPaymentGateway` (`domain/payment-gateway.ts`) es el puerto; `WompiPaymentGateway`
(`infrastructure/wompi-payment-gateway.ts`) la implementacion real, sin SDK (mismo criterio que
`dian-soap-client.ts`/`resend-email-notifier.ts`). El flujo elegido es **Web Checkout por
redireccion** (no el Widget embebido ni tokenizacion de tarjeta): el backend nunca ve ni maneja
datos de tarjeta, evitando alcance PCI-DSS.

- `POST /admin/subscriptions/:id/checkout` (`{ customerEmail, redirectUrl? }`,
  `CreateSubscriptionCheckoutUseCase`): el monto se deriva del plan segun `billingCycle`
  (mensual/anual) — nunca del request, para que no se pueda manipular. Crea un
  `SubscriptionPayment` en `PENDING` con una `reference` unica **por intento de cobro** (no por
  suscripcion, permite reintentar tras un `DECLINED` sin chocar con nada), y devuelve la URL de
  `checkout.wompi.co` ya firmada (`buildCheckoutUrl`, calculo 100% local — SHA256 de
  `reference+amountInCents+"COP"+integritySecret`, sin separador, verificado byte a byte contra el
  ejemplo oficial de `docs.wompi.co/en/docs/colombia/widget-checkout-web`, ver
  `wompi-payment-gateway.spec.ts`).
- `POST /admin/subscriptions/webhooks/wompi` (**publico**, sin `requirePlatformAdmin` — lo llama
  Wompi, no un usuario del panel): `ConfirmWompiPaymentUseCase` verifica la firma del evento
  (`verifyWebhookSignature`, SHA256 de los valores de `signature.properties` **en el orden que
  trae el propio evento** + `timestamp` + events secret — nunca se asume un orden fijo, Wompi
  documenta que puede variar) antes de tocar cualquier dato. Si la firma no verifica, si el evento
  no es `transaction.updated`, o si no hay un `SubscriptionPayment` `PENDING` con esa `reference`
  (proteccion contra doble aplicacion si Wompi reenvia el mismo webhook), se ignora en silencio
  (siempre responde `200` igual, para no generar reintentos infinitos de un evento que nunca se va
  a poder procesar). Si `APPROVED`: aplica el pago con el mismo calculo de vencimiento que
  `RegisterSubscriptionPaymentUseCase` (`calculateNextPeriodEnd` desde `currentPeriodEnd`
  **ORIGINAL**, no desde la fecha del pago). Si `DECLINED`/`ERROR`/`VOIDED`: marca el pago como
  `FAILED`, no toca la suscripcion.
- Vacios por defecto (`WOMPI_PUBLIC_KEY`/`WOMPI_INTEGRITY_SECRET`/`WOMPI_EVENTS_SECRET`,
  `config/env.ts`) = generar un checkout falla con `ValidationError` clara (a diferencia de
  `ResendEmailNotifier`/`IDianClient`, este metodo lo invoca directo un endpoint HTTP, asi que el
  error tiene que llegarle al que hizo el request, no quedar como un `500` opaco).
- **Verificado en vivo con llaves de sandbox reales** (no solo con fakes): `buildCheckoutUrl`
  genero una URL que `checkout.wompi.co` acepto con `200` (firma de integridad confirmada contra
  el servicio real, no solo contra el ejemplo de la documentacion); el flujo completo
  checkout→webhook→confirmacion se probo contra Postgres real simulando un evento
  `transaction.updated APPROVED` firmado con el events secret real, confirmando que la
  suscripcion pasa a `ACTIVE` con el vencimiento correcto, el pago queda `CONFIRMED`, y un
  reintento del mismo evento (Wompi puede reenviar webhooks) no lo vuelve a aplicar. **Lo unico
  que NO se pudo verificar en este entorno**: que el algoritmo de `verifyWebhookSignature`
  coincida exactamente con un webhook 100% real enviado por Wompi (para eso hace falta completar
  un pago de verdad con una tarjeta de prueba a traves del navegador y tener una URL publica
  registrada en el dashboard de Wompi como destino del webhook) — el algoritmo implementado sigue
  la documentacion oficial al pie de la letra, pero esa pieza especifica quedo verificada solo por
  autoconsistencia (mismo codigo genera y verifica), no contra el servicio real.

## Envio real de recordatorios (iteracion 17)

`IReminderNotifier` (`domain/reminder-notifier.ts`) es el puerto que arma y envia el correo;
`ResendEmailNotifier` (`infrastructure/resend-email-notifier.ts`) es la implementacion real, via
`fetch` directo a la API de Resend (sin SDK, mismo criterio que `dian-soap-client.ts`).

- **NO PROBADO end-to-end contra Resend real** — mismo aviso que la integracion DIAN: el formato
  del payload y el codigo de respuesta siguen la documentacion publica de Resend al momento de
  escribir esto, pero nadie confirmo la entrega real con una cuenta de Resend de verdad.
- `RESEND_API_KEY` vacio por defecto (`config/env.ts`) = envio deshabilitado. Verificado en este
  entorno: sin la key, `ResendEmailNotifier.send` lanza con un mensaje claro
  (`RESEND_API_KEY no esta configurado`) y el tick del poller **no se cae** (se captura en
  `RunSubscriptionLifecycleUseCase`, mismo patron que `PollDianSubmissionsUseCase`).
- **`SubscriptionReminderLog` solo se crea si el envio tuvo exito** — antes se creaba
  incondicionalmente (el registro significaba "se debia enviar"; ahora `sentAt` significa "se
  envio"). Un fallo del proveedor (o la key sin configurar) deja el recordatorio SIN registrar,
  asi que el siguiente ciclo del poller (1 hora despues) reintenta automaticamente en vez de
  perderlo silenciosamente.
- Cada intento queda auditado: `SUBSCRIPTION_REMINDER_SENT` si se envio, `SUBSCRIPTION_REMINDER_FAILED`
  con el mensaje de error si no.
- `ISubscriptionRepository.listForLifecycleCheck` ahora incluye `companyName`/`companyEmail`/
  `planName` (antes solo devolvia el `Subscription` sin datos de empresa) — el notifier los
  necesita para armar el asunto/cuerpo del correo.
- **WhatsApp implementado en la iteracion 41** (`docs/ALCANCE.md` item 41): `RunSubscriptionLifecycleUseCase`
  intenta WhatsApp primero (`IWhatsAppSender`, `modules/whatsapp`) cuando `Company.phone` esta
  registrado, y cae automaticamente a email si falla o no esta configurado (mismo criterio de
  cascada que `RunCollectionsRemindersUseCase` en `collections`). `SubscriptionReminderLog.channel`
  ahora si guarda `"WHATSAPP"` cuando ese fue el canal que funciono. Sigue bloqueado por la misma
  limitacion de siempre: la API de WhatsApp Business requiere verificacion de negocio en Meta y
  plantillas de mensaje pre-aprobadas, un proceso externo no completable en este entorno — ver
  `modules/whatsapp/README.md` para el detalle completo (incluye el envio de documentos por
  WhatsApp: RIDE de factura y desprendible de nomina, tambien parte del item 41).

## Que falta implementar

1. Verificacion end-to-end de WhatsApp contra la API real de Meta — ver
   `modules/whatsapp/README.md` (bloqueado por verificacion de negocio, no es un problema de
   codigo).
2. Actualizaciones automaticas de `apps/web`/`apps/mobile` ("Nueva version disponible") — fuera
   del alcance de este backend, responsabilidad de Service Worker / Expo OTA updates.
3. Wompi: confirmar `verifyWebhookSignature` contra un webhook 100% real (ver limitacion en la
   seccion dedicada arriba) — falta completar un pago de prueba end-to-end por navegador con una
   URL publica registrada en el dashboard de Wompi.
4. Wompi: sin UI web todavia para generar el link de cobro desde el panel
   (`apps/web/src/features/platform-admin`) — hoy solo existe el endpoint
   (`POST /admin/subscriptions/:id/checkout`), un admin de plataforma lo llamaria a mano o via un
   script para mandarle el link al cliente.
5. Wompi: no hay reconciliacion automatica para pagos cuyo webhook se pierda (Wompi reintenta
   webhooks fallidos por su cuenta, pero no hay un job propio que consulte
   `GET /v1/transactions/:id` con `WOMPI_PRIVATE_KEY` para pagos que quedaron `PENDING` demasiado
   tiempo) — la llave privada esta preparada en `config/env.ts` para esto, pero no se uso todavia.
