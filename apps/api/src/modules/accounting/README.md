# Modulo: Contabilidad (STUB)

Estado: **modelo de datos completo en Prisma, sin logica de negocio implementada.**

## Modelos ya disponibles (`packages/database/prisma/schema/accounting.prisma`)

- `ChartOfAccounts` — plan de cuentas jerarquico (`AccountType`: ASSET/LIABILITY/EQUITY/INCOME/EXPENSE).
- `JournalEntry` + `JournalEntryLine` — comprobantes (libro diario), con `sourceType`/`sourceId`
  para trazar el origen (venta, compra, nomina, ajuste manual).
- `FinancialPeriod` — control de periodos abiertos/cerrados por mes.
- `BankAccount`, `BankTransaction`, `BankReconciliation` + `BankReconciliationItem` — conciliacion bancaria.

## Que falta implementar

1. CRUD del plan de cuentas (plantilla PUC colombiana sugerida como seed inicial).
2. Generacion automatica de comprobantes (`JournalEntry`) al:
   - Completar una venta (`Sale` -> debito Caja/Bancos o Cuentas por Cobrar, credito Ingresos + IVA).
   - Registrar una compra (`Purchase` -> debito Inventario, credito Cuentas por Pagar).
   - Calcular nomina (`Payroll` -> debito Gasto de Nomina, credito Bancos + pasivos laborales).
   - Cerrar caja con diferencia (`CashSession.difference` -> ajuste contable).
3. Libro mayor: agregacion de `JournalEntryLine` por cuenta y periodo.
4. Balance General y Estado de Resultados: derivados del libro mayor segun `AccountType`.
5. Flujo de caja: derivado de `CashMovement` + `BankTransaction`.
6. Conciliacion bancaria: emparejar `BankTransaction` con `JournalEntryLine` (o registrar
   diferencias) y cerrar el periodo (`FinancialPeriod.status = CLOSED`).

Por ahora las rutas devuelven `501 Not Implemented` (ver `interfaces/accounting.routes.ts`).
