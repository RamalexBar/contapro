# Modulo: Proveedores / Compras

Estado: **CRUD minimo de proveedores y registro de compras (con contabilizacion automatica)
implementado. Orden de compra, recepcion de mercancia y abonos a cuentas por pagar
pendientes.**

## Modelos (`packages/database/prisma/schema/suppliers.prisma`)

- `Supplier` — datos del proveedor (NIT, contacto).
- `PurchaseOrder` + `PurchaseOrderItem` — orden de compra (sin uso todavia).
- `GoodsReceipt` + `GoodsReceiptItem` — recepcion de mercancia (sin uso todavia).
- `Purchase` — factura de compra. Tiene `subtotal`/`taxTotal`/`total` (agregados junto con
  este registro minimo; antes solo tenia `total`).
- `AccountPayable` + `SupplierPayment` — cuentas por pagar y sus abonos (se crea el
  `AccountPayable` al registrar la compra; los abonos/`SupplierPayment` aun no tienen endpoint).

## Implementado

1. CRUD basico de proveedores: `POST /suppliers` y `GET /suppliers` (permiso `suppliers.manage`
   / `suppliers.read`).
2. `POST /purchases`: registra una factura de compra directamente (sin pasar por orden de
   compra ni recepcion de mercancia), crea su `AccountPayable` a termino completo y genera y
   contabiliza el comprobante correspondiente
   (`modules/accounting/application/use-cases/post-purchase-journal-entry.use-case.ts`):
   debito Inventario + IVA descontable, credito Proveedores nacionales.
3. Auditoria: `SUPPLIER_CREATED`, `PURCHASE_REGISTERED`.

## Que falta implementar

1. Flujo de orden de compra: crear -> enviar -> recibir (parcial o total).
2. Al recibir mercancia (`GoodsReceipt`), generar automaticamente:
   - `StockMovement` tipo `PURCHASE_IN` por cada item (ver `modules/inventory/stock`).
   - `Batch` si el producto `tracksBatches` (con `expirationDate`).
   - Actualizacion de `Product.currentCost` (costo promedio/ultimo/FIFO segun `costMethod`).
3. Abonos a `AccountPayable` (`SupplierPayment`), con su propio comprobante contable (credito
   Bancos/Caja, debito Proveedores nacionales) siguiendo el mismo patron que
   `post-purchase-journal-entry.use-case.ts`.
4. Anulacion de una compra registrada (reversar `AccountPayable` y anular el `JournalEntry`
   via `VoidJournalEntryUseCase`).

Las rutas de orden de compra, recepcion de mercancia y cuentas por pagar siguen devolviendo
`501 Not Implemented` (ver `interfaces/suppliers.routes.ts`).
