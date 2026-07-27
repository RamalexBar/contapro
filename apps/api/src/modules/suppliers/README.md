# Modulo: Proveedores / Compras (STUB)

Estado: **modelo de datos completo en Prisma, sin logica de negocio implementada.**

## Modelos ya disponibles (`packages/database/prisma/schema/suppliers.prisma`)

- `Supplier` — datos del proveedor (NIT, contacto).
- `PurchaseOrder` + `PurchaseOrderItem` — orden de compra.
- `GoodsReceipt` + `GoodsReceiptItem` — recepcion de mercancia (con lote/vencimiento opcional).
- `Purchase` — factura de compra.
- `AccountPayable` + `SupplierPayment` — cuentas por pagar y sus abonos.

## Que falta implementar

1. CRUD de proveedores (`domain/supplier.repository.ts`, casos de uso, controller/routes).
2. Flujo de orden de compra: crear -> enviar -> recibir (parcial o total).
3. Al recibir mercancia (`GoodsReceipt`), generar automaticamente:
   - `StockMovement` tipo `PURCHASE_IN` por cada item (ver `modules/inventory/stock`).
   - `Batch` si el producto `tracksBatches` (con `expirationDate`).
   - Actualizacion de `Product.currentCost` (costo promedio/ultimo/FIFO segun `costMethod`).
4. Registro de `Purchase` + `AccountPayable` con su cronograma de pagos.
5. `SupplierPayment` debe generar el `JournalEntry` correspondiente cuando el modulo de
   contabilidad este implementado (ver `modules/accounting/README.md`).
6. Auditoria: registrar creacion de ordenes, recepciones y pagos (nuevas acciones en
   `modules/audit/domain/audit-log.repository.ts` -> `AuditAction`).

Por ahora las rutas devuelven `501 Not Implemented` (ver `interfaces/suppliers.routes.ts`).
