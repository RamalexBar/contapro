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

## Estado actual (actualizado 2026-08-27) — LEER ESTO PRIMERO EN UNA SESIÓN NUEVA

Historial completo iteración por iteración: `docs/ALCANCE.md`. Esto es solo el resumen de **por
dónde íbamos** en la conversación más reciente, para retomarla en otra máquina sin perder
contexto (el código y los commits ya están en GitHub, esto es solo la narrativa).

### Contexto de negocio

Se hizo un comparativo de Contapro contra Alegra/Siigo/World Office/Loggro (funcionalidad +
precio) — Contapro gana en precio (todo incluido, sin fragmentar módulos) y en varios módulos
(comisiones, activos fijos, CRM, cobranza con Wompi nativo), pierde en trayectoria (cero clientes
reales) y en amplitud de IA (Alegra tiene 38 funciones, Contapro apenas 1). Ver `docs/PRECIOS.md`
para el snapshot de precios de la competencia (2026-08-03).

**Esta semana** se está conectando la facturación electrónica DIAN con un **proveedor
tecnológico** externo (reemplaza la integración directa SOAP+XAdES propia, nunca verificada
contra el servicio real de la DIAN) — es la pieza de mayor riesgo que queda abierta. Sin novedades
de esto todavía en esta conversación, quedó como plan, no como trabajo iniciado aquí.

### Lo que se implementó en esta sesión (commit `68044a3`, ya subido a `origin/master`)

1. **Conciliación bancaria — desempate por texto** (`SuggestBankReconciliationMatchesUseCase`,
   `apps/api/src/modules/accounting/application/description-similarity.ts`): cuando varios
   comprobantes candidatos quedan a fechas parecidas de una transacción, ya no gana "el primero de
   la lista" sino el que comparte más palabras con la descripción del banco (índice de Jaccard).
   Conectado a la UI (`BankingPage.tsx`, pestaña Conciliaciones → expandir una en progreso):
   sugerencias con botón "Confirmar", ya no hay que pegar IDs a mano (el formulario manual sigue
   ahí como respaldo). Sigue siendo 1 a 1, no soporta pagos partidos (documentado como pendiente
   en el README del módulo).
2. **Lectura automática de facturas de compra con IA** (`POST /purchases/extract`,
   `ExtractPurchaseInvoiceUseCase`, `ClaudeInvoiceExtractionService`): sube una foto/PDF de
   factura, Claude (`claude-opus-5`, visión + salida estructurada con Zod) extrae proveedor/NIT/
   número/fecha/subtotal/IVA/total, intenta emparejar con un proveedor ya existente por NIT o
   nombre inequívoco, y sugiere fecha de vencimiento a 30 días. **Nunca crea la compra sola** — el
   usuario revisa y confirma con el `POST /purchases` de siempre. Conectado a la UI
   (`SuppliersPage.tsx` → Registrar compra → botón "Leer factura (foto/PDF)").

### Pendiente — lo primero que hay que retomar

- **`ANTHROPIC_API_KEY` sin configurar todavía** (ni local ni en Render) — sin esto,
  `POST /purchases/extract` responde 422 con mensaje claro, no se puede probar. El usuario iba a
  crear la llave en console.anthropic.com y no había terminado ese paso cuando cambió de equipo.
- **La lectura de facturas nunca se probó contra una factura real.** Había dos candidatas
  encontradas en `C:\Users\alexa\Downloads` de la máquina anterior (`factura chec manizales.pdf`,
  el usuario eligió esa) — en la máquina nueva hay que ubicar el archivo de nuevo (Downloads no se
  clona con git) o pedirle otra factura al usuario.
- **Fase "conciliación bancaria con IA" del plan original todavía no se hizo** (usar IA para los
  casos que el desempate por texto no resuelve) — se decidió dejarla para después de facturas.
- El proveedor tecnológico de facturación electrónica DIAN (ver "Contexto de negocio" arriba)
  sigue siendo un plan del usuario, no algo que se haya trabajado en esta conversación.

### Artifacts publicados (viven en la cuenta de Claude, no en este repo — se ven desde cualquier PC logueado)

- **Contapro vs. El Mercado** — comparativo con Alegra/Siigo/World Office/Loggro, actualizado tras
  agregar lectura de facturas.
- **Contapro en Marcha** — manual de instalación en Render, lenguaje no técnico.
- **Manual de Funcionamiento Contapro** — manual de uso diario, navegable por módulo (también
  guardado como HTML/PDF/Word en `C:\Users\alexa\Documents\Contapro-Manuales\` de la máquina
  anterior — esos archivos locales sí hay que volver a generarlos o copiarlos a mano en el PC
  nuevo, no viven en git).

Buscar estos tres por nombre en `/artifacts` o en claude.ai/code/artifacts si hace falta el link
de nuevo — no hace falta regenerarlos desde cero, ya existen.
