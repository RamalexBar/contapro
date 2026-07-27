# Modulo: Panel Administrador SaaS (STUB)

Estado: **modelo de datos completo en Prisma, sin logica de negocio implementada.**

## Modelos ya disponibles (`packages/database/prisma/schema/tenant.prisma`)

- `Plan` — planes de suscripcion (mensual/anual, limites de sucursales/usuarios, features).
- `Subscription` — suscripcion de cada empresa (`status`: TRIALING/ACTIVE/GRACE_PERIOD/
  SUSPENDED/CANCELLED, `currentPeriodEnd`, `graceEndsAt`).
- `SubscriptionPayment` — historial de pagos.
- `SubscriptionReminderLog` — registro de recordatorios enviados (8/5/3/1 dias antes + dia de
  vencimiento), para no reenviar duplicados (`@@unique([subscriptionId, daysBeforeDue])`).

## Reglas de negocio ya documentadas (pendientes de implementar)

1. **Periodo de gracia de EXACTAMENTE 2 dias** tras el vencimiento (`Subscription.graceEndsAt
   = currentPeriodEnd + 2 dias`). Durante esos 2 dias el cliente puede seguir entrando y renovar.
   Pasado ese plazo, la cuenta pasa a `SUSPENDED` automaticamente (sin borrar informacion).
   Helper ya listo: `calculateGraceEndsAt()` en `packages/shared-utils/src/dates.ts`.
2. **Renovacion**: si el pago llega dentro del periodo de gracia, el nuevo vencimiento se
   calcula desde la fecha de vencimiento ORIGINAL (nunca desde la fecha de pago), para que el
   cliente nunca gane dias por pagar tarde. Helper ya listo: `calculateNextPeriodEnd()` en
   `packages/shared-utils/src/dates.ts` (incluye el ejemplo del spec: vence 31 agosto, paga
   2 de septiembre, nuevo vencimiento 30 de septiembre).
3. **Recordatorios automaticos** 8/5/3/1 dias antes y el dia del vencimiento, por correo y
   notificacion in-app (WhatsApp preparado para el futuro, ver `channel` en
   `SubscriptionReminderLog`). Requiere un job programado (cron) que no existe aun.
4. **Actualizaciones automaticas** ("Nueva version disponible", actualizar sin reinstalar):
   fuera del alcance de este backend (es responsabilidad de `apps/web` con Service Worker y
   de `apps/mobile` con Expo OTA updates) — documentado aqui como referencia cruzada.

## Que falta implementar

1. CRUD de planes y suscripciones (solo accesible por un rol "super-admin" de plataforma,
   distinto de los roles por empresa).
2. Job programado (cron) que recorra `Subscription` diariamente y:
   - Envie recordatorios pendientes (`SubscriptionReminderLog`).
   - Pase a `GRACE_PERIOD` las vencidas, y a `SUSPENDED` las que superaron `graceEndsAt`.
3. Endpoint de pago/renovacion que aplique `calculateNextPeriodEnd`.
4. Vistas agregadas para el panel: empresas activas/suspendidas/proximas a vencer, ingresos
   mensuales, historial de pagos, clientes activos/inactivos.

Por ahora las rutas devuelven `501 Not Implemented` (ver `interfaces/saas-admin.routes.ts`).
