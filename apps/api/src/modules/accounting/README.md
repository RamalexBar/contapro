# Modulo: Contabilidad

Estado: **plan de cuentas, comprobantes, contabilizacion automatica de nomina/venta/compra/abono a
proveedor/ajuste de caja, reportes (libro mayor, Balance General, Estado de Resultados, flujo de
caja), conciliacion bancaria (manual, con sugerencia de matches) y cierre de periodo, todo
implementado.**

## Modelos (`packages/database/prisma/schema/accounting.prisma`)

- `ChartOfAccounts` — plan de cuentas jerarquico (`AccountType`: ASSET/LIABILITY/EQUITY/INCOME/EXPENSE).
- `JournalEntry` + `JournalEntryLine` — comprobantes (libro diario), con `sourceType`/`sourceId`
  para trazar el origen (venta, compra, nomina, abono, ajuste de caja, ajuste manual).
- `FinancialPeriod` — control de periodos abiertos/cerrados por mes (iteracion 15, ver punto 8 mas
  abajo).
- `BankAccount`, `BankTransaction`, `BankReconciliation` + `BankReconciliationItem` — conciliacion
  bancaria.

## Implementado

1. CRUD del plan de cuentas (`ChartOfAccountsRepository` + `CreateAccountUseCase`).
   Jerarquia por `parentId`, `level` calculado automaticamente. Sin plantilla PUC precargada
   todavia (las cuentas se crean a mano o vienen del seed que use cada caso de uso).
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

## Que falta implementar

1. Flujo de caja como Estado de Flujo de Efectivo formal (metodo indirecto desde el Estado de
   Resultados) — hoy es un resumen directo simplificado.
