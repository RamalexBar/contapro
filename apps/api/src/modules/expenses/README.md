# Modulo: Gastos operativos

Estado: **catalogo de categorias de gasto por empresa, registro de gastos (pagados completo de
una vez, sin cuentas por pagar) con contabilizacion automatica, y cancelacion, todo
implementado.** Item 30 de `docs/ALCANCE.md` ("Brecha funcional vs. Alegra/Siigo").

## Por que no es una extension de Proveedores/Compras

`Purchase` (modulo `suppliers`) esta pensado para mercancia: `PostPurchaseJournalEntryUseCase`
**siempre** debita la cuenta fija `1435 Inventarios`, y `AccountPayable.purchaseId` es una FK
obligatoria a `Purchase`. Reusarlo para un arriendo o una factura de servicios publicos habria
significado o bien contabilizar mal (como inventario) o agregar logica condicional y hacer
nullable esa FK -- mas trabajo y mas riesgo que un modulo paralelo. Tampoco sirve `CashMovement`
(modulo `cash`): requiere una `CashSession` abierta (FK obligatoria), no tiene categoria ni
`JournalEntry` propio -- es una libreta de caja para el arqueo, no contabilidad de partida doble.

## Modelos (`packages/database/prisma/schema/expenses.prisma`)

- `ExpenseCategory` -- catalogo por empresa (`code`, `name`, `accountCode`: el codigo PUC de la
  cuenta de gasto asociada, ej. `5120`). Analogo a `WithholdingConcept` del modulo `accounting`
  (catalogo configurable, no un enum fijo -- cada negocio categoriza distinto), pero vive aqui
  porque el unico lector de sus datos ya resueltos es `PostExpenseJournalEntryUseCase`.
- `Expense` -- `payeeName` (texto libre: el arrendador, la empresa de servicios -- a proposito
  NO un `Supplier`), `subtotal`/`taxTotal`/`total`, `paymentMethod` (`CASH`/`CARD`/`TRANSFER`,
  uno solo, pagado completo al registrarse), `status` (`REGISTERED`/`CANCELLED`),
  `journalEntryId` (para poder anularlo al cancelar), `costCenterId` opcional (item 34 de
  `docs/ALCANCE.md` -- ver `modules/accounting/README.md` punto 10; validado activo/existente en
  `CreateExpenseUseCase` y copiado tal cual al `JournalEntry` que este gasto genera).

## Decision de alcance: sin credito

Un gasto **siempre se registra ya pagado** -- no hay `ExpensePayable` ni flujo de abonos, a
diferencia de `AccountPayable`/`SupplierPayment` en `suppliers`. Decision explicita (no un
recorte por falta de tiempo): cubre bien los casos reales del gap analysis (arriendo, servicios,
reembolsos a empleados), que normalmente se pagan cuando se registran. Si en el futuro hace falta
gastos a credito (ej. una factura de servicios que vence a 30 dias), el patron a seguir es el
mismo de `suppliers`: un `ExpensePayable` + `ExpensePayment` + su propio
`PostExpensePaymentJournalEntryUseCase`.

## Implementado

1. CRUD de categorias: `GET/POST /expense-categories`, `PATCH /expense-categories/:id`,
   `POST /expense-categories/:id/deactivate` (sin borrado, mismo criterio que `ChartOfAccounts`
   y `WithholdingConcept` -- solo desactivar). Permisos `expense.manage`/`expense.read`.
2. **7 categorias por defecto** sembradas por empresa (`packages/database/src/seed-expense-categories.ts`,
   llamado desde `RegisterCompanyUseCase` para empresas nuevas y desde el backfill de
   `seedBase()` para las ya existentes -- mismo mecanismo que `DEFAULT_WITHHOLDING_CONCEPTS`),
   con codigos PUC comunes de gastos de administracion **sin verificar contra un contador real**
   (mismo criterio de honestidad que las tarifas de retencion del item 29):

   | code | nombre | cuenta |
   |---|---|---|
   | ARRIENDO | Arrendamientos | 5120 |
   | SERVICIOS | Servicios publicos | 5135 |
   | HONORARIOS | Honorarios | 5110 |
   | MANTENIMIENTO | Mantenimiento y reparaciones | 5145 |
   | PUBLICIDAD | Publicidad y propaganda | 5165 |
   | PAPELERIA | Papeleria y utiles de oficina | 5155 |
   | DIVERSOS | Diversos (otros gastos) | **5195** -- misma cuenta que ya usa
     `PostCashSessionAdjustmentJournalEntryUseCase` (modulo `accounting`) para faltantes de caja;
     sinergia intencional, `upsertByCode` la encuentra en vez de duplicarla (verificado en vivo:
     una sola fila `5195` en el plan de cuentas tras registrar un gasto `DIVERSOS`).

3. `POST /expenses`: valida que la categoria este activa y que `subtotal + taxTotal === total`,
   crea el `Expense` y lo contabiliza de una vez
   (`PostExpenseJournalEntryUseCase`, modulo `accounting`): debito la cuenta de la categoria
   (autocreada con `upsertByCode` la primera vez, tipo `EXPENSE`) + debito `2408` IVA descontable
   si `taxTotal > 0` (misma cuenta que ya usa `Purchase`), credito Caja (`1105`, metodo `CASH`) o
   Bancos (`1110`, cualquier otro metodo) por el total. Guarda el id del comprobante en
   `Expense.journalEntryId`.
4. `POST /expenses/:id/cancel`: marca `CANCELLED` y anula el comprobante
   (`voidJournalEntryUseCase`, generico, reusado tal cual de `accounting.container.ts`) -- mas
   simple que `CancelPurchaseUseCase` porque no hay abonos que reversar.
5. `GET /expenses`: listado paginado (`take`/`skip`).
6. Auditoria: `EXPENSE_CATEGORY_CREATED`, `EXPENSE_CATEGORY_UPDATED`,
   `EXPENSE_CATEGORY_DEACTIVATED`, `EXPENSE_REGISTERED`, `EXPENSE_CANCELLED`.
7. UI web (`/expenses`, permiso `expense.read` en el nav): pestañas "Gastos" (registro + listado
   con boton Cancelar) y "Categorias" (CRUD inline, calco de la pestaña "Retenciones" de
   `AccountingPage.tsx`).

Verificado en vivo end-to-end contra Postgres local: las 7 categorias llegan correctamente
aisladas por empresa (`GET /expense-categories` devuelve exactamente 7 para la empresa demo, sin
mezclar con otras empresas -- `ExpenseCategory`/`Expense` se agregaron a `TENANT_MODELS`
[`apps/api/src/shared/prisma/tenant.extension.ts`] **desde el mismo commit que se crearon los
modelos**, a diferencia del item 29 donde `WithholdingConcept` se agrego sin este paso y causo
una fuga cross-tenant real detectada recien en verificacion en vivo); gasto con IVA pagado por
transferencia (comprobante balanceado, cuenta `5110` autocreada); cancelacion (comprobante
anulado, segundo intento de cancelar rechazado); categoria inactiva rechazada (422); `CAJERO`
recibe 403 en `GET /expenses` (no tiene `expense.read` por defecto).

## Que falta implementar

1. Gastos a credito (`ExpensePayable`/`ExpensePayment`) -- decision de alcance explicita, ver
   arriba, no un pendiente por descuido.
2. Reportes especificos de gastos por categoria/periodo (hoy solo se pueden inferir del libro
   mayor filtrando por cuenta, `GET /reports/ledger/:accountId`, modulo `accounting`).
