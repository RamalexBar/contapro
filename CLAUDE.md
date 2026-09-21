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

## Estado actual (actualizado 2026-09-18) — LEER ESTO PRIMERO EN UNA SESIÓN NUEVA

Historial completo iteración por iteración: `docs/ALCANCE.md`. Esto es solo el resumen de **por
dónde íbamos** en la conversación más reciente, para retomarla en otra máquina sin perder
contexto (todo el código de esta sesión ya está commiteado y pusheado a `origin/master`, y
desplegado en Render — ver commits `b78e5d3`..`cb9f20e`).

### Contexto de negocio

Se hizo un comparativo de Contapro contra Alegra/Siigo/World Office/Loggro (funcionalidad +
precio) — Contapro gana en precio (todo incluido, sin fragmentar módulos) y en varios módulos
(comisiones, activos fijos, CRM, cobranza con Wompi nativo), pierde en trayectoria (cero clientes
reales) y en amplitud de IA (Alegra tiene 38 funciones, Contapro apenas 1). Ver `docs/PRECIOS.md`
para el snapshot de precios de la competencia (2026-08-03).

**El proveedor tecnológico de facturación electrónica DIAN — la pieza de mayor riesgo que quedaba
abierta — avanzó fuerte en esta sesión** (2026-09-18): reunión con Factus a las 4:30pm, el usuario
consiguió credenciales de su sandbox, y se construyó una segunda integración completa (ver punto 1
abajo). MATIAS sigue siendo la otra opción ya integrada desde antes; la decisión de cuál usar en
producción (o si valen ambas para clientes distintos) sigue abierta — ver memoria
`dian-tech-provider.md` para el comparativo completo MATIAS vs Factus vs Plemsi y el precio de
Factus (todavía sin confirmar, tema para retomar con ellos).

### Lo que se implementó en esta sesión (commiteado y desplegado)

1. **Segundo proveedor tecnológico DIAN: Factus API** (`Company.electronicInvoicingProvider` ahora
   acepta `DIRECT | MATIAS | FACTUS`, `infrastructure/factus-invoicing-client.ts`,
   `application/resolve-third-party-provider.ts` para no duplicar el if/else de "qué cliente y qué
   credencial usar" entre `GenerateElectronicInvoiceUseCase` y `ResubmitElectronicInvoiceUseCase`).
   **Verificado de punta a punta contra el sandbox real de Factus**, incluyendo una venta completa
   generada a través del flujo real de Contapro (`POST /sales` → factura `ACCEPTED` con CUFE y XML
   firmado reales) — más verificación de la que se pudo hacer para MATIAS en su momento. Detalle
   completo (arquitectura OAuth2 password-grant, `numbering_range_id` propio de Factus, etc.) en
   `apps/api/src/modules/electronic-invoicing/README.md`, punto 15. UI en
   `IntegrationsPage.tsx` → Facturación electrónica (DIAN), ya permite elegir Factus y cargar sus
   5 credenciales. Migración `20260918170000_add_factus_provider` ya aplicada en la base local.
2. **Lector de extractos bancarios con IA** (`POST /bank-accounts/extract-statement`,
   `ExtractBankStatementUseCase`, `ClaudeStatementExtractionService`): mismo patrón que la lectura
   de facturas de compra — sube foto/PDF del extracto, Claude devuelve la lista de movimientos
   (fecha/descripción/monto/débito-crédito), el usuario desmarca lo que no corresponda y confirma;
   cada fila se registra con el `POST /bank-accounts/:id/transactions` ya existente, sin endpoint
   de alta masiva propio. Conectado a `BankingPage.tsx` → Movimientos. **NO probado contra un
   extracto real todavía** — quedó bloqueado por saldo insuficiente en `ANTHROPIC_API_KEY` (ver
   "Pendiente"), solo se verificó que el endpoint completo está bien conectado.
3. **Limpieza de planes de facturación**: se eliminaron 4 planes fantasma
   (`FACT_EMPRENDEDOR/PYME/PRO/PLUS`, una línea "Solo Facturación" copiada de Alegra el
   2026-09-03) de `seed-base.ts`, de la base local, de la base de **producción de Render** (borrado
   a mano vía Shell, confirmado 2026-09-21) y de `LandingPage.tsx` — contradecían la estrategia de
   precios de Contapro ("todo incluido, sin fragmentar"). Quedan solo `TRIAL`/`BASICO`/`PYME`/`PRO`
   en ambas bases.
4. Se armó y publicó como Artifact una ficha de preparación para la reunión con Factus (stack
   técnico, qué comprarles, preguntas para ellos, Q&A anticipado) — buscarla como "Reunión con
   Factus" en `/artifacts` si hace falta el link de nuevo.
5. **Landing pública (`LandingPage.tsx`) rediseñada con selector PUC/NIIF + certificado digital +
   integraciones** (2026-09-21): antes de ver el detalle completo de los 3 planes reales, el
   visitante debe elegir PUC o NIIF (gatea la tabla de planes, atenuada hasta elegir); toggle
   mensual/anual con precios y ahorro reales del seed; bloque separado de certificado digital de
   firma electrónica ($130.000 COP/año, cargo aparte, exigido por la DIAN); sección de
   integraciones vía API con CTA de documentación (placeholder). **PUC/NIIF y el certificado son
   solo UI por ahora** — no hay plantilla de plan de cuentas NIIF ni flujo de checkout del
   certificado en el backend; "Elegir plan" pasa la elección como query params a `/register`,
   listo para conectarse el día que exista esa lógica real.

### Pendiente — lo primero que hay que retomar

- **`ANTHROPIC_API_KEY` se quedó sin saldo** ("Your credit balance is too low") — bloquea tanto el
  lector de extractos bancarios nuevo como la lectura de facturas de compra ya existente. Hay que
  recargar en console.anthropic.com antes de poder probar cualquiera de las dos con un archivo
  real.
- **Precio real de Factus todavía sin confirmar** — la reunión de las 4:30pm era el momento de
  preguntarlo directamente (ver ficha de preparación). Sin esto, no se puede decidir MATIAS vs
  Factus vs ambos para producción.
- **PUC/NIIF y certificado digital son solo UI todavía** (ver punto 5 arriba) — falta la plantilla
  de plan de cuentas NIIF real y el flujo de checkout/compra del certificado digital si se decide
  llevar esto a producción de verdad.
- **Fase "conciliación bancaria con IA para desempate" del plan original** (usar IA para los casos
  que el desempate por texto de `description-similarity.ts` no resuelve) sigue sin hacer — se hizo
  en cambio el lector de extractos (una feature distinta, ver punto 2 arriba).

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
