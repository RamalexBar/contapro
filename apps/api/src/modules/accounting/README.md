# Modulo: Contabilidad

Estado: **plan de cuentas y comprobantes (libro diario) implementados. Flujo de caja y
conciliacion bancaria pendientes.**

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
3. Generacion automatica del comprobante de nomina al aprobar un periodo
   (`PostPayrollJournalEntryUseCase`): crea (con `upsertByCode`) y postea las 7 cuentas
   estandar de nomina la primera vez que se necesitan.
4. Libro mayor, Balance General y Estado de Resultados
   (`AccountingReportsService`), derivados de las lineas de comprobantes `POSTED`.
5. Auditoria: `ACCOUNT_CREATED`, `JOURNAL_ENTRY_CREATED`, `JOURNAL_ENTRY_POSTED`,
   `JOURNAL_ENTRY_VOIDED`.

Falta generar el comprobante automatico al completar una venta o registrar una compra
(ver comentarios en `PostPayrollJournalEntryUseCase` como referencia del patron a seguir).

## Que falta implementar

1. Generacion automatica de comprobantes al completar una venta (`Sale` -> debito
   Caja/Bancos o Cuentas por Cobrar, credito Ingresos + IVA) y al registrar una compra
   (`Purchase` -> debito Inventario, credito Cuentas por Pagar).
2. Ajuste contable al cerrar caja con diferencia (`CashSession.difference`).
3. Flujo de caja: derivado de `CashMovement` + `BankTransaction`.
4. Conciliacion bancaria: emparejar `BankTransaction` con `JournalEntryLine` (o registrar
   diferencias) y cerrar el periodo (`FinancialPeriod.status = CLOSED`).

Las rutas de flujo de caja y conciliacion bancaria siguen devolviendo `501 Not Implemented`
(ver `interfaces/accounting.routes.ts`).
