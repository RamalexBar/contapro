# Modulo: Contabilidad

Estado: **plan de cuentas, comprobantes, contabilizacion automatica de nomina/venta/compra/abono a
proveedor/ajuste de caja/gasto operativo/cobro de cuenta por cobrar, reportes (libro mayor,
Balance General, Estado de Resultados, flujo de caja), conciliacion bancaria (manual, con
sugerencia de matches), cierre de periodo, retenciones (RteFuente/ReteICA/ReteIVA) en ventas y
compras y centros de costo, todo implementado.**

## Modelos (`packages/database/prisma/schema/accounting.prisma`)

- `ChartOfAccounts` — plan de cuentas jerarquico (`AccountType`: ASSET/LIABILITY/EQUITY/INCOME/EXPENSE).
- `JournalEntry` + `JournalEntryLine` — comprobantes (libro diario), con `sourceType`/`sourceId`
  para trazar el origen (venta, compra, nomina, abono, ajuste de caja, ajuste manual).
- `FinancialPeriod` — control de periodos abiertos/cerrados por mes (iteracion 15, ver punto 8 mas
  abajo).
- `BankAccount`, `BankTransaction`, `BankReconciliation` + `BankReconciliationItem` — conciliacion
  bancaria.
- `WithholdingConcept` — conceptos de retencion configurables por empresa (RteFuente/ReteICA/
  ReteIVA, codigo/nombre/tarifa%), aplicados en `SaleWithholding`/`PurchaseWithholding`
  (`packages/database/prisma/schema/pos.prisma` / `suppliers.prisma`) con la tarifa snapshoteada
  al momento de aplicarse (ver punto 9).
- `CostCenter` — catalogo simple por empresa (codigo/nombre/activo, mirror de `WithholdingConcept`)
  para etiquetar comprobantes por area/proyecto (item 34, ver punto 10).

## Implementado

1. CRUD del plan de cuentas (`ChartOfAccountsRepository` + `CreateAccountUseCase`).
   Jerarquia por `parentId`, `level` calculado automaticamente. **PUC precargado y activacion por
   catalogo** (iteracion 43, item 44 de docs/ALCANCE.md, ver punto 11 mas abajo) — cada empresa
   arranca con la jerarquia completa del plan de cuentas ya creada; una cuenta se crea a mano solo
   si el usuario necesita algo fuera del catalogo estandar.
2. Comprobantes manuales: creacion con validacion de partida doble (debitos = creditos, no
   ambos en la misma linea, cuenta debe `acceptsEntries`), posteo (`DRAFT -> POSTED`) y
   anulacion (`PostJournalEntryUseCase` / `VoidJournalEntryUseCase`).
3. Generacion automatica de comprobantes al ocurrir el hecho economico, cada uno con sus
   cuentas estandar (`upsertByCode`, se crean solas la primera vez que se usan):
   - `PostPayrollJournalEntryUseCase` — nomina: devengado + aportes patronales + provisiones
     vs neto a pagar + retenciones + pasivos. Se invoca desde `ApprovePayrollUseCase` al
     aprobar el periodo (`modules/payroll`).
   - `PostSaleJournalEntryUseCase` — venta completada (`CreateSaleUseCase` /
     `AuthorizeDiscountUseCase` en `modules/pos/sale`): debito Caja/Bancos/Clientes segun el
     metodo de pago registrado, credito Ingresos por ventas + IVA generado (cuenta 2408).
   - `PostPurchaseJournalEntryUseCase` — compra registrada (`CreatePurchaseUseCase` en
     `modules/suppliers`): debito Inventario + IVA descontable (misma cuenta 2408, que el PUC
     colombiano netea entre IVA generado y descontable), credito Proveedores nacionales.
   - `PostSupplierPaymentJournalEntryUseCase` — abono a una cuenta por pagar
     (`RegisterSupplierPaymentUseCase` en `modules/suppliers`): debito Proveedores nacionales,
     credito Caja general (metodo `CASH`) o Bancos (cualquier otro metodo).
   - `PostCashSessionAdjustmentJournalEntryUseCase` — diferencia de un arqueo de caja
     (`CloseCashSessionUseCase` en `modules/cash/cash-session`): sobrante (contado > esperado)
     debito Caja / credito cuenta nueva `4295 Diversos (otros ingresos)`; faltante (contado <
     esperado) debito cuenta nueva `5195 Diversos (gastos)` / credito Caja. Sin comprobante si la
     diferencia es cero.
   - `PostExpenseJournalEntryUseCase` — gasto operativo registrado (`CreateExpenseUseCase` en
     `modules/expenses`, item 30 de `docs/ALCANCE.md`): debito la cuenta de la
     `ExpenseCategory` (autocreada dinamicamente con `upsertByCode` a partir de su
     `accountCode`/`name` — el unico `Post*JournalEntryUseCase` del repo donde la cuenta de gasto
     no es fija de antemano en `STANDARD_ACCOUNTS`) + debito `2408` IVA descontable si aplica,
     credito Caja o Bancos por el total. Sin comprobante si el total es cero. Un gasto siempre se
     paga completo al registrarse (sin cuentas por pagar de gastos, decision de alcance explicita
     — ver `modules/expenses/README.md`).
   - `PostReceivableCollectionJournalEntryUseCase` — cobro (abono en persona o pago en línea
     confirmado por webhook) sobre una `AccountReceivable` (`modules/collections`, item 31 de
     `docs/ALCANCE.md`): débito Caja (método `CASH`) o Bancos (cualquier otro método), crédito
     `1305 Clientes` — espejo exacto de `PostSupplierPaymentJournalEntryUseCase`. La cuenta por
     cobrar en sí no dispara contabilización propia al crearse: la venta a crédito que la origina
     ya debitó "Clientes" al completarse (mecanismo `method: "CREDIT"` que ya existía en
     `PostSaleJournalEntryUseCase`, ver `modules/collections/README.md`).
4. Anulacion de un comprobante desde otro modulo: `VoidJournalEntryUseCase` (generico, ya
   existia) se exporta desde `accounting.container.ts` como `voidJournalEntryUseCase` para que
   `CancelPurchaseUseCase` (`modules/suppliers`) pueda anular el comprobante de una compra
   cancelada.
5. Reportes (`AccountingReportsService`), derivados de las lineas de comprobantes `POSTED`:
   - Libro mayor, Balance General y Estado de Resultados (ya existian).
   - `getCashFlow(from, to)` — **flujo de caja simplificado**: entradas/salidas de `CashMovement`
     (`SALE_IN`/`INCOME`/`DEPOSIT` = entrada, `EXPENSE`/`WITHDRAWAL` = salida, agregado via un
     metodo nuevo `sumMovementsByType` en `ICashSessionRepository`) y de `BankTransaction`
     (`CREDIT` = entrada, `DEBIT` = salida — **convencion elegida y documentada en
     `domain/bank-transaction.repository.ts`**, no hay ninguna previa en el codebase que lo
     defina). **No es un Estado de Flujo de Efectivo formal** (metodo indirecto desde el Estado
     de Resultados) — es un resumen directo de movimientos de caja/banco en el periodo, mucho mas
     simple. `GET /reports/cash-flow?from=&to=`.
6. Conciliacion bancaria (manual, con sugerencia de matches por monto/fecha — iteracion 20):
   - `POST /bank-accounts`, `GET /bank-accounts` — alta/listado de cuentas bancarias.
   - `POST /bank-accounts/:id/transactions`, `GET /bank-accounts/:id/transactions` — alta manual
     de una linea de extracto (no hay integracion real con ningun banco) y su listado.
   - `POST /bank-reconciliations` — inicia una conciliacion (`IN_PROGRESS`) para una cuenta y
     periodo; recibe `statementBalance` (saldo del extracto) y `bookBalance` (saldo segun libros)
     **como datos de entrada, no derivados del libro mayor** — no hay ningun enlace en el schema
     entre `BankAccount` y una cuenta especifica de `ChartOfAccounts`.
   - `GET /bank-reconciliations/:id/suggested-matches` (iteracion 20,
     `SuggestBankReconciliationMatchesUseCase`) — compara cada `BankTransaction` sin conciliar de
     la cuenta contra las lineas de comprobantes `POSTED` de la empresa dentro de una ventana de
     ±5 dias del periodo de la conciliacion, por **monto exacto** (no hay forma de filtrar por
     cuenta contable, ver punto anterior). `confidence: "EXACT"` si ademas la fecha coincide
     exactamente, `"PROBABLE"` si esta dentro de la ventana. Heuristica greedy (una linea no se
     sugiere dos veces; ver comentario en el caso de uso) — es de solo lectura, no crea ningun
     `BankReconciliationItem`, el usuario confirma cada sugerencia con el endpoint de match de
     abajo. Excluye transacciones ya `reconciled` y lineas ya usadas en cualquier conciliacion
     `matched: true` de la empresa.
   - `POST /bank-reconciliations/:id/match` — el usuario elige que `BankTransaction` corresponde
     a que `JournalEntryLine` (ambos opcionales/independientes, tipicamente a partir de una
     sugerencia de arriba, pero tambien se puede llamar a mano); crea el
     `BankReconciliationItem` y marca `BankTransaction.reconciled = true` si aplica.
   - `POST /bank-reconciliations/:id/close` — `IN_PROGRESS -> COMPLETED`. **No exige que la
     diferencia sea cero** — la diferencia final (`statementBalance - bookBalance`) queda visible
     en la respuesta para que el usuario decida.
   - `GET /bank-reconciliations`, `GET /bank-reconciliations/:id`.
7. Auditoria: `ACCOUNT_CREATED`, `JOURNAL_ENTRY_CREATED`, `JOURNAL_ENTRY_POSTED`,
   `JOURNAL_ENTRY_VOIDED`, `BANK_ACCOUNT_CREATED`, `BANK_TRANSACTION_REGISTERED`,
   `BANK_RECONCILIATION_STARTED`, `BANK_RECONCILIATION_ITEM_MATCHED`, `BANK_RECONCILIATION_CLOSED`,
   `FINANCIAL_PERIOD_CLOSED`, `FINANCIAL_PERIOD_REOPENED`.
8. **Cierre de periodo** (`FinancialPeriod`, iteracion 15):
   - `POST /financial-periods/:year/:month/close` — exige que no existan comprobantes `DRAFT` con
     fecha dentro de ese mes (deben publicarse o anularse primero). Crea/actualiza la fila
     `FinancialPeriod` a `CLOSED`.
   - `POST /financial-periods/:year/:month/reopen` — vuelve a `OPEN` (correccion puntual); falla
     si el periodo nunca se cerro.
   - `GET /financial-periods?year=` — historial (solo aparecen periodos que se cerraron alguna
     vez; un mes sin fila esta implicitamente `OPEN`).
   - El bloqueo real vive en `CreateJournalEntryUseCase` (punto unico de creacion de comprobantes,
     tanto manuales como los automaticos de venta/compra/nomina/abono/ajuste de caja): rechaza
     con `409 CONFLICT` cualquier comprobante nuevo con `date` dentro de un periodo `CLOSED`.
   - **No genera asiento de cierre** (traslado de ingresos/gastos a una cuenta de utilidades
     retenidas) — el Balance General ya calcula la utilidad acumulada dinamicamente hasta la
     fecha de corte (`AccountingReportsService.getBalanceSheet`), asi que "cerrar" aqui es un
     bloqueo de edicion sobre el periodo, no un cierre contable formal de libros.
   - No exige que las cuentas bancarias de la empresa esten conciliadas para ese mes (a
     diferencia de lo que se especulaba antes de implementarlo) — se dejo como una validacion
     mas simple y explicita (sin drafts pendientes) para no acoplar el cierre a que la empresa
     use conciliacion bancaria en absoluto.

9. **Retenciones en ventas y compras** (`WithholdingConcept`, item 29 de `docs/ALCANCE.md`):
   - `WithholdingConcept` es un catalogo por empresa (`GET/POST /withholding-concepts`,
     `PATCH /withholding-concepts/:id`, `POST /withholding-concepts/:id/deactivate`, gateados por
     `accounting.manage`/`.read` — no se creo un permiso nuevo). Cada empresa arranca con 6
     conceptos por defecto (`packages/database/src/seed-withholding-concepts.ts`, sembrados desde
     `RegisterCompanyUseCase` al registrarse y con backfill en `seedBase()` para empresas ya
     existentes): compras/servicios/honorarios/arrendamientos (RETEFUENTE, tarifas de mercado
     comunes), un ICA generico **que cada empresa debe ajustar a su municipio/actividad**
     (la tarifa real varia demasiado para tener un default correcto) y ReteIVA 15%. No hay
     tabla de codigo por municipio ni de conceptos DIAN completos — es deliberadamente simple.
   - **Una cuenta contable fija por tipo (no por concepto)**: 3 nuevas para ventas
     (135515/135517/135518, ASSET — "anticipo de impuestos", porque quien retiene es el
     *cliente*, es plata que Contapro puede descontar en su propia declaracion) y 3 para compras
     (236540/236801/236705, LIABILITY — porque aqui es Contapro quien retiene *a su proveedor*,
     un pasivo pendiente de declarar/pagar a la DIAN). Igual que la cuenta `2408` de IVA, se
     autocrean con `upsertByCode` la primera vez que se usan.
   - **Ventas** (`PostSaleJournalEntryUseCase`): `Sale.total` sigue siendo el bruto legal de la
     factura; lo que cambia es cuanto efectivo se cobra realmente (`netTotal = total -
     retentionTotal`, comparado contra los pagos registrados en vez de `total`) y que aparecen
     lineas debito nuevas por cada tipo de retencion con monto > 0.
   - **Compras** (`PostPurchaseJournalEntryUseCase` + `PrismaPurchaseRepository.create`):
     `AccountPayable.amount`/`.balance` quedan **netos de retencion desde su creacion** — es el
     unico cambio real que hizo falta para que abonos (`RegisterSupplierPaymentUseCase`) y
     cancelacion (`CancelPurchaseUseCase`) sigan funcionando sin ninguna modificacion: ambos ya
     operaban solo sobre `AccountPayable.balance`, nunca sobre `Purchase.total`. Verificado en
     vivo: compra con ReteICA, abono de la cuenta neta, cancelacion con reverso completo del
     abono y del comprobante — sin tocar esos dos casos de uso.
   - **Limitacion deliberada, igual que ya acepta el codigo para `2408`**: las 6 cuentas de
     retencion solo acumulan saldo, no existe ningun flujo de "declarar/pagar la retencion a la
     DIAN" — quedaria para una futura iteracion de gastos/obligaciones fiscales.
   - Verificado en vivo end-to-end contra Postgres local: los 6 conceptos por defecto llegan
     correctamente aislados por empresa (ver nota de seguridad abajo), venta con RteFuente
     (comprobante balanceado, `netTotal` cobrado en efectivo), XML UBL con bloque
     `<cac:WithholdingTaxTotal>` y CUFE con ICA distinto de una venta sin retencion, compra con
     ReteICA (`AccountPayable` neto), abono contra esa cuenta neta, cancelacion con reverso
     completo, concepto inactivo rechazado (422), concepto inexistente/de otra empresa rechazado
     (404), y venta con retencion dentro de un periodo cerrado sigue bloqueada (409).
   - **Nota de seguridad encontrada y corregida durante esta misma iteracion**: `WithholdingConcept`
     se agrego sin registrarlo en `TENANT_MODELS`
     (`apps/api/src/shared/prisma/tenant.extension.ts`) — el `list()` del repositorio (`findMany`
     sin `companyId` en el `where`) devolvia los conceptos de **todas** las empresas mezclados,
     detectado en la verificacion en vivo (30 filas en vez de 6 para la empresa demo). Corregido
     agregando `"WithholdingConcept"` al set; `create()`/`findByIdOrThrow()` ya pasaban
     `companyId` explicito y nunca estuvieron expuestos. Mismo tipo de hallazgo que la auditoria
     de seguridad de la iteracion 25 (ver fila "Seguridad" en `docs/ALCANCE.md`) — recordatorio de
     que todo modelo nuevo con `companyId` debe agregarse ahi, el propio comentario del archivo lo
     advierte pero es facil de pasar por alto.
   - Facturacion electronica: ver `electronic-invoicing/README.md` (bloque `WithholdingTaxTotal`
     en el XML de venta, ICA wireado en el CUFE). El documento soporte de compras (proveedor no
     obligado a facturar) **no** lleva retenciones todavia — seguimiento menor pendiente, mismo
     patron de archivo que el de venta una vez se necesite.

10. **Centros de costo** (`CostCenter`, item 34 de `docs/ALCANCE.md`):
    - Hallazgo que fijo el diseño: `JournalEntry.branchId` (presente desde la iteracion 1) es el
      precedente de "campo de segmentacion que nunca se uso" — se persiste al crear el comprobante
      pero ningun reporte lo filtra ni existe selector en la UI. Para no repetir ese error, el
      filtro en reportes se trato como parte obligatoria de este item, no un extra.
    - `GET/POST /cost-centers`, `PATCH /cost-centers/:id`, `POST /cost-centers/:id/deactivate`
      (gateados por `accounting.manage`/`.read`, sin permiso nuevo) — calco exacto de
      `WithholdingConcept` (mismos 4 casos de uso, mismo repositorio, sin `type`/`ratePercent`).
    - `JournalEntry.costCenterId` (nullable, sin FK declarada — mismo criterio que `accountId`/
      `branchId`) se puede etiquetar en dos caminos, ambos contenidos a proposito:
      1. Comprobante manual (`POST /journal-entries`, `createJournalEntrySchema.costCenterId`).
      2. Gasto operativo (`modules/expenses`, item 30) — el caso de uso de libro de texto para
         centros de costo (arriendo/servicios/honorarios por sucursal o proyecto); al ser un
         registro 1:1 sin carrito, agregar el campo fue un cambio pequeño con valor real
         inmediato. `CreateExpenseUseCase` valida que el centro de costo exista y este activo
         (mismo criterio que ya usa para `ExpenseCategory`) y lo pasa tal cual a
         `PostExpenseJournalEntryUseCase`, que no toca ninguna cuenta/monto.
      - **Fuera de alcance a proposito**: los otros 7 `Post*JournalEntryUseCase` (venta, compra,
        nomina, devolucion, abono a proveedor, cobro, ajuste de caja) — `branchId` ya es su
        dimension natural; agregarles centro de costo exigiria sumar el concepto tambien a cada
        dominio de origen (carrito de venta, nomina por empleado, etc.), una expansion mucho mayor
        no justificada por este item.
    - `CreateJournalEntryUseCase` valida el centro de costo (existe + activo) igual que ya valida
      cada `accountId` de las lineas — rechaza uno inexistente (404) o inactivo (422).
    - **Reportes**: `AccountingReportsService.getIncomeStatement`/`getLedger` ganan un parametro
      `costCenterId` opcional, propagado hasta `IJournalEntryRepository.listPostedLines` (filtra
      por `journalEntry.costCenterId` en el `where` anidado — se omite del todo cuando no se pasa,
      sin cambiar el comportamiento existente). Balance General y Flujo de caja **no** ganan este
      filtro (la practica contable estandar segmenta el Estado de Resultados por centro de costo,
      no las cuentas de balance).
    - UI web (`/accounting`): pestaña nueva "Centros de costo" (CRUD), selector en el comprobante
      manual, selector de filtro en Estado de Resultados y Libro Mayor (mismo patron que el
      selector de cuenta que el Libro Mayor ya tenia). `modules/expenses`: selector en el
      formulario de registrar gasto, columna en la tabla de gastos.
    - Verificado en vivo end-to-end: dos centros de costo, comprobante manual y gasto etiquetados
      cada uno con uno distinto, Estado de Resultados y Libro Mayor filtrados muestran exactamente
      las lineas del centro seleccionado (y todo sin filtrar), centro de costo inactivo rechazado
      (422), inexistente rechazado (404), aislamiento multi-tenant del catalogo, regresion
      confirmada (comprobante sin `costCenterId` sigue devolviendo `null`). Los 182 tests previos
      del repo no se rompieron (9 nuevos: `create-journal-entry.use-case.spec.ts` nuevo,
      `create-expense.use-case.spec.ts` y `post-expense-journal-entry.use-case.spec.ts`
      extendidos).

11. **PUC precargado y activacion por catalogo** (`seedDefaultChartOfAccounts`,
    `packages/database/src/seed-chart-of-accounts.ts`, iteracion 43, item 44 de
    `docs/ALCANCE.md`):
    - Cada empresa nueva arranca con la jerarquia completa del PUC ya creada (clase -> grupo ->
      cuenta -> subcuenta), sembrada por `RegisterCompanyUseCase` y con backfill en `seedBase()`
      para empresas que ya existian (mismo patron que `seedDefaultWithholdingConcepts`/
      `seedDefaultExpenseCategories`, con las mismas dos llamadas agregadas ademas a mano en
      `seed.ts` para la empresa demo — su `company.upsert` corre DESPUES de `seedBase()`, asi que
      el backfill de ese archivo no la alcanza en un `pnpm db:seed` desde cero).
    - **No es la codificacion oficial completa del Decreto 2650** (esa tiene miles de cuentas
      auxiliares irrelevantes para una pyme de comercio) — es un PUC simplificado para pymes de
      comercio/servicios, sin verificar contra un contador real (mismo criterio de honestidad que
      `DEFAULT_WITHHOLDING_CONCEPTS`/`DEFAULT_EXPENSE_CATEGORIES`). Cubre clases 1-6; se omiten
      clase 7 (costos de produccion/manufactura) y 8-9 (cuentas de orden), fuera del alcance
      actual del producto. Los ~25 codigos que el motor contable ya usaba de antemano
      (`STANDARD_ACCOUNTS` en cada `Post*JournalEntryUseCase`) quedan **activos desde el
      registro**; el resto del catalogo (unas 65 cuentas mas) queda **inactivo** hasta que el
      usuario lo active.
    - `ChartOfAccounts.isActive` ya existia en el schema (default `true`) pero no se usaba en
      ningun lado — ni un endpoint para cambiarlo ni un chequeo que lo respetara. Ahora
      `CreateJournalEntryUseCase` rechaza (422) un comprobante que use una cuenta inactiva, y
      `POST /chart-of-accounts/:id/activate` / `.../deactivate` (permiso `accounting.manage`,
      `SetAccountActiveUseCase`) permiten cambiarla desde el catalogo.
    - `upsertByCode` (usado por todos los `Post*JournalEntryUseCase` para resolver sus cuentas
      estandar) ahora reactiva sola una cuenta que el usuario haya desactivado a mano si el motor
      contable la vuelve a necesitar — mismo criterio que "se crean solas la primera vez que se
      usan", ahora extendido a "se reactivan solas si hace falta".
    - UI web (`/accounting`, pestaña "Plan de cuentas"): buscador por codigo o nombre
      (`AccountCombobox`, cascada por prefijo — escribir "15" filtra ese grupo y todas sus
      cuentas) que reemplaza el `<select>` plano en los tres lugares donde se elegia una cuenta
      (cuenta padre al crear una cuenta nueva, lineas de un comprobante manual, filtro de cuenta
      del libro mayor); tabla del catalogo con boton "Activar"/"Desactivar" por fila (solo en
      cuentas que admiten movimientos).
    - El codigo `5135` tiene una tension pre-existente entre `PostCommissionJournalEntryUseCase`
      ("Comisiones") y la categoria de gasto "Servicios publicos" de
      `DEFAULT_EXPENSE_CATEGORIES` (mismo codigo, dos nombres distintos segun quien lo cree
      primero via `upsertByCode`) — el PUC precargado le da el nombre "Comisiones" por ser el que
      ya estaba activo de antemano; no afecta el registro de un gasto de esa categoria porque la
      descripcion de esa linea del comprobante toma el nombre de la categoria, no el de la
      cuenta.
    - Verificado con `tsc --noEmit` + `vitest run` (268 tests, 1 nuevo: rechazo de una linea
      contra una cuenta inactiva) en todo `apps/api`, y `tsc -b && vite build` en `apps/web`.
    - **Cuenta base vs. subcuenta/auxiliar** (mismo dia, a pedido del usuario): convencion PUC
      real — la cuenta base (clase/grupo/cuenta) es solo de clasificacion, el movimiento
      transaccional queda en la subcuenta/auxiliar. `CreateAccountUseCase` ahora, al crear una
      cuenta con `parentId`, desactiva `acceptsEntries` de la cuenta padre si esta en nivel
      clase/grupo/cuenta (nivel ≤ 3) y hoy admite movimientos (`disableDirectEntries`, nuevo en
      `IChartOfAccountsRepository`, idempotente). **Alcance deliberadamente acotado** (decidido
      con el usuario via pregunta explicita, para no reescribir el motor ya verificado): las ~20
      cuentas de 4 digitos que los 9 `Post*JournalEntryUseCase` usan de antemano
      (`ENGINE_MANAGED_ACCOUNT_CODES` en `create-account.use-case.ts`) quedan exentas — si el
      usuario les agrega una subcuenta propia, la cuenta base sigue admitiendo movimientos
      directos para no romper la contabilizacion automatica de ventas/compras/nomina/etc. Una
      subcuenta (nivel 4, `111005` por ejemplo) o auxiliar (nivel 5+) que gane su propio hijo NO
      se desactiva — solo la cuenta base de 4 digitos pierde `acceptsEntries`, subcuentas y
      auxiliares pueden seguir admitiendo movimiento segun la necesidad del usuario, tengan o no
      mas detalle debajo. Auditado (`ACCOUNT_ENTRIES_DISABLED`). UI: nota explicativa agregada en
      el formulario "Nueva cuenta"; el resto de la UI (buscador, boton Activar/Desactivar) no
      necesito cambios porque ya filtraba por `acceptsEntries`. Verificado en vivo: crear una
      subcuenta bajo `1524 Equipo de oficina` (no gestionada por el motor) desactivo `1524`; crear
      una bajo `1105 Caja general` (si gestionada) no la desactivo. 5 tests nuevos
      (`create-account.use-case.spec.ts`, no existia antes) — 273 en total.

## Que falta implementar

1. Flujo de caja como Estado de Flujo de Efectivo formal (metodo indirecto desde el Estado de
   Resultados) — hoy es un resumen directo simplificado.
2. Retenciones en el documento soporte electronico de compras (ver punto 9 de "Implementado").
3. Flujo de "declarar/pagar" las retenciones practicadas a la DIAN — las cuentas 236540/236801/
   236705 solo acumulan saldo (ver punto 9).
4. Centro de costo solo se puede etiquetar en comprobantes manuales y gastos operativos — no en
   venta/compra/nomina/devolucion/abono/cobro/ajuste de caja (ver punto 10, decision de alcance
   explicita). Balance General y Flujo de caja tampoco filtran por centro de costo.
5. El PUC precargado (punto 11) es un catalogo simplificado, no la codificacion oficial completa
   del Decreto 2650 — sin verificar contra un contador real.
