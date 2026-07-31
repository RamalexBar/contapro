# Modulo: Panel Administrador SaaS

Estado: **implementado.** Autenticacion de plataforma separada, CRUD de planes y suscripciones,
cobro/renovacion, vista de empresas, dashboard agregado, y poller de recordatorios/vencimiento/
suspension automatica.

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
   suscripcion `TRIALING` contra el plan `TRIAL` por **30 dias** — el spec original no especifica
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
   intervalo de 1 hora): genera un `SubscriptionReminderLog` en 8/5/3/1/0 dias antes del
   vencimiento, pasa a `GRACE_PERIOD` lo vencido (`graceEndsAt = currentPeriodEnd + 2 dias`,
   `calculateGraceEndsAt`) y a `SUSPENDED` lo que supero el periodo de gracia (sin borrar
   informacion). **El envio real del recordatorio (correo/WhatsApp) NO esta implementado** — no
   hay ningun proveedor de email/mensajeria integrado en el codebase todavia; se genera el
   registro (`channel: "EMAIL"`) como rastro de que "el recordatorio debia enviarse", mismo
   criterio que la firma/envio DIAN: la logica de negocio esta completa, la integracion externa
   real no.
7. Auditoria (donde hay `companyId` valido — no aplica a `Plan`): `SUBSCRIPTION_CREATED`,
   `SUBSCRIPTION_PAYMENT_REGISTERED`, `SUBSCRIPTION_STATUS_CHANGED`.

## Que falta implementar

1. Envio real de recordatorios (proveedor de email/WhatsApp) — ver punto 6 arriba.
2. Actualizaciones automaticas de `apps/web`/`apps/mobile` ("Nueva version disponible") — fuera
   del alcance de este backend, responsabilidad de Service Worker / Expo OTA updates.
3. UI web del panel (hoy solo API).
