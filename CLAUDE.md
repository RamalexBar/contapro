# CLAUDE.md

Guía de orientación para trabajar en este repo con Claude Code. Para el resto:
[`README.md`](./README.md) (arranque local, stack, troubleshooting),
[`docs/ARQUITECTURA.md`](./docs/ARQUITECTURA.md) (decisiones y convenciones a fondo),
[`docs/ALCANCE.md`](./docs/ALCANCE.md) (qué está implementado módulo por módulo, iteración por
iteración — es la fuente de verdad más detallada, este archivo no la reemplaza).

## Qué es esto

Contapro: ERP SaaS multiempresa/multisucursal para pequeños negocios en Colombia (inspirado en
Alegra/Siigo/World Office/Siesa). Monorepo pnpm + Turborepo: `apps/api` (Express+TS), `apps/web`
(React+Vite+TS+Tailwind), `apps/mobile` (Expo), `packages/database` (Prisma), `packages/shared-types`,
`packages/shared-utils`.

## Comandos esenciales

```bash
pnpm --filter @erp/api dev          # API en :4000 (tsx watch)
pnpm --filter @erp/web dev          # Web en :5173
pnpm --filter @erp/mobile start     # Expo

pnpm --filter @erp/api test          # vitest (apps/api)
pnpm --filter @erp/api build         # tsc -p tsconfig.json (typecheck + emite dist/)
pnpm --filter @erp/web build         # tsc -b && vite build (typecheck + build)

pnpm db:migrate --name <nombre>     # prisma migrate dev (packages/database)
pnpm db:seed                        # siembra la empresa demo
pnpm db:studio                      # Prisma Studio
```

Login demo: `admin@demo.com` / `Demo1234!` (Administrador), `cajero@demo.com` / `Demo1234!`
(Cajero), `platform@demo.com` / `Demo1234!` (panel SaaS, `POST /api/admin/auth/login`).

## Convenciones que hay que seguir

- **Multi-tenant row-level**: toda tabla de negocio tiene `companyId`. El Prisma Client Extension
  (`apps/api/src/shared/prisma/tenant.extension.ts`) inyecta `companyId` automáticamente en
  `findMany/findFirst/count/updateMany/deleteMany/create` desde el `AsyncLocalStorage` de la
  request. **`update`/`delete`/`findUnique` por `id` NO quedan cubiertos** — todo repositorio debe
  hacer `findFirst({ where: { id, companyId } })` primero para confirmar pertenencia al tenant.
- **Clean Architecture por módulo** (`apps/api/src/modules/<módulo>/`): `domain/` (puertos, sin
  Prisma/Express) → `application/` (casos de uso) → `infrastructure/` (Prisma) → `interfaces/`
  (controller/routes/validators zod). Cada módulo expone un `<módulo>.container.ts` que compone
  todo a mano (sin DI framework) y se registra en `apps/api/src/app.ts`. Para reusar un caso de
  uso entre módulos, se exporta la instancia desde el container del módulo dueño (ver
  `postSaleJournalEntryUseCase` en `accounting.container.ts`, `createSaleUseCase` en
  `sale.container.ts`) — nunca se duplica lógica de negocio.
- **Testing**: `vitest`, solo en `apps/api`. Se testean casos de uso (con repos fake en memoria,
  no mocks de Prisma) y funciones puras (generadores XML/PDF). El código de infraestructura muy
  acoplado a transacciones Prisma (ej. `PrismaSaleRepository`) se verifica en vivo contra un
  Postgres real corriendo, no con specs — ver "Cómo verificar cambios" abajo.
- **RBAC**: permisos granulares en `packages/shared-types/src/permissions.ts`
  (`PERMISSIONS`/`DEFAULT_ROLE_PERMISSIONS`/`SYSTEM_ROLES`), sembrados por `packages/database/prisma/seed.ts`.
  Antes de crear un permiso nuevo para una feature, revisar si uno ya existente cubre la misma
  acción (ej. sync push/pull reusa `sale.create`/`product.read` en vez de crear los suyos).
- **Auditoría inmutable**: `AuditLog` solo expone `create` (nunca `update`/`delete`). Nuevas
  acciones auditables se agregan al union type `AuditAction` en
  `apps/api/src/modules/audit/domain/audit-log.repository.ts`.
- **Integraciones externas sin credenciales reales** (DIAN, Resend): se implementan completas
  (HTTP real, sin mocks/SDKs pesados — `fetch` directo) pero quedan documentadas como "no
  verificadas contra el servicio real" cuando no hay credenciales de producción disponibles. Las
  variables de entorno correspondientes son opcionales con default `""`, y el código falla con un
  mensaje claro (no un crash silencioso) cuando faltan — ver `dian-soap-client.ts` y
  `resend-email-notifier.ts` como referencia del patrón.
- **Documentación**: cada módulo implementado tiene su propio `README.md` con el detalle real
  (qué se implementó, qué falta, limitaciones conocidas). `docs/ALCANCE.md` es el índice de alto
  nivel por iteración — actualizarlo junto con el README del módulo cuando se cierra un pendiente,
  y revisar que no queden frases stale tipo "sin UI web todavía" en filas ya actualizadas por
  iteraciones posteriores (pasó varias veces en esta sesión).

## Gotchas de este entorno (Windows)

- **`EPERM` al correr `prisma generate`/`migrate`**: el motor de Prisma queda cargado en memoria
  mientras `apps/api` corre con `tsx watch`. Hay que detener ese proceso antes de migrar/regenerar.
- **`tsx watch` puede dejar procesos huérfanos en el puerto 4000** tras varios reinicios seguidos
  (edición de archivos + `EADDRINUSE` en el log), lo que lleva a probar cambios contra código
  viejo sin darse cuenta. Si algo se comporta de forma inexplicable en pruebas en vivo, matar el
  proceso en el puerto 4000 y arrancar uno limpio antes de seguir investigando.
- **`prisma migrate dev` es interactivo** y falla en este entorno no-interactivo incluso con
  `--create-only`. Alternativa: escribir la carpeta/archivo de migración a mano (mismo formato que
  las ya existentes en `packages/database/prisma/schema/migrations/`) y aplicar con
  `prisma migrate deploy` (no interactivo).

## Cómo verificar cambios

No hay suite E2E. El patrón seguido en todo este trabajo: `tsc --noEmit` + `vitest run` primero,
después probar en vivo contra el Postgres local vía `curl` (login → ejercitar el endpoint nuevo →
inspeccionar el resultado, a veces con un script `.mjs` desechable en `packages/database/` contra
el cliente Prisma para verificar el estado exacto en la base). Para PDFs, se generan y se leen
con la herramienta de lectura para inspeccionar el layout renderizado, no solo el tamaño del
buffer. Para el móvil, sin emulador/dispositivo en este entorno: se verifica con `tsc --noEmit`
únicamente y se dice explícitamente que no se probó en runtime — nunca reportar como "probado"
algo que solo compiló.

## Resumen de lo implementado en esta sesión (iteraciones 13–18)

Punto de partida: iteración 12 (panel administrador SaaS backend) recién cerrada. Se completó
**todo** lo que quedaba pendiente en `docs/ALCANCE.md`:

1. **Iteración 13** — UI web de Contabilidad, Proveedores y Panel administrador SaaS (hasta
   entonces solo tenían API). Más el endpoint `GET /api/purchases` que faltaba.
2. **Iteración 14** — PDF del desprendible de nómina (`GET /payslips/:id/pdf`, `pdfkit`, generado
   al vuelo desde `PayslipDocument.summaryJson`) — distinto del RIDE de nómina electrónica DIAN.
3. **Iteración 15** — Cierre de período contable (`FinancialPeriod`): bloquea comprobantes nuevos
   (manuales y automáticos) con fecha dentro de un mes cerrado; no genera asiento de cierre
   formal (el Balance General ya calcula la utilidad acumulada dinámicamente).
4. **Iteración 16** — Proveedores: cancelar una compra con abonos ya no responde `409`, los
   reversa primero (`SupplierPayment.status`, anula el comprobante de cada uno). POS: consumo
   FIFO real (antes solo existía el dato de entrada por lote, nada lo consumía) — corrige además
   que el costo registrado en `StockMovement` de una venta FIFO sea el costo real de los lotes
   consumidos, no el precio de venta.
5. **Iteración 17** — Envío real de recordatorios de vencimiento de suscripción por correo
   (`IReminderNotifier` / `ResendEmailNotifier`, vía Resend). El log de recordatorio enviado ahora
   solo se crea si el envío tuvo éxito (antes se creaba siempre, sin enviar nada realmente).
6. **Iteración 18** — Sincronización offline real en el móvil (solo ventas): `POST /sync/push`
   (idempotente, reusa `CreateSaleUseCase`) y `GET /sync/pull`. Se encontró y corrigió un bug real
   en la comparación de payloads (Postgres JSONB no preserva el orden de las claves). `POSScreen`
   pasó a leer siempre de la cache local (offline-first real).

Todos los ítems de la lista "Próximos pasos sugeridos" de `docs/ALCANCE.md` quedaron resueltos o
explícitamente fuera de alcance con su razón documentada (WhatsApp real, NetInfo, Kardex,
credenciales DIAN de producción). Ver ese archivo para el detalle punto por punto y qué queda
como trabajo futuro dentro de módulos ya implementados.
