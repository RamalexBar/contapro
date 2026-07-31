# Modulo: Contabilidad

Estado: **plan de cuentas, comprobantes y contabilizacion automatica de nomina/venta/compra
implementados. Flujo de caja y conciliacion bancaria pendientes.**

## Modelos (`packages/database/prisma/schema/accounting.prisma`)

- `ChartOfAccounts` — plan de cuentas jerarquico (`AccountType`: ASSET/LIABILITY/EQUITY/INCOME/EXPENSE).
- `JournalEntry` + `JournalEntryLine` — comprobantes (libro diario), con `sourceType`/`sourceId`
  para trazar el origen (venta, compra, nomina, ajuste manual).
- `FinancialPeriod` — control de periodos abiertos/cerrados por mes (aun sin uso).
- `BankAccount`, `BankTransaction`, `BankReconciliation` + `BankReconciliationItem` — conciliacion
  bancaria (aun sin uso).

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
4. Anulacion de un comprobante desde otro modulo: `VoidJournalEntryUseCase` (generico, ya
   existia) ahora se exporta desde `accounting.container.ts` como `voidJournalEntryUseCase` para
   que `CancelPurchaseUseCase` (`modules/suppliers`) pueda anular el comprobante de una compra
   cancelada.
5. Libro mayor, Balance General y Estado de Resultados
   (`AccountingReportsService`), derivados de las lineas de comprobantes `POSTED`.
6. Auditoria: `ACCOUNT_CREATED`, `JOURNAL_ENTRY_CREATED`, `JOURNAL_ENTRY_POSTED`,
   `JOURNAL_ENTRY_VOIDED`.

## Que falta implementar

1. Ajuste contable al cerrar caja con diferencia (`CashSession.difference`).
2. Flujo de caja: derivado de `CashMovement` + `BankTransaction`.
3. Conciliacion bancaria: emparejar `BankTransaction` con `JournalEntryLine` (o registrar
   diferencias) y cerrar el periodo (`FinancialPeriod.status = CLOSED`).

Las rutas de flujo de caja y conciliacion bancaria siguen devolviendo `501 Not Implemented`
(ver `interfaces/accounting.routes.ts`).
