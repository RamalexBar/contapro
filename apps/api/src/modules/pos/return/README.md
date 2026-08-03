# Modulo: Devoluciones (Return)

Estado: **implementado (iteracion 22)**. `Return`/`ReturnItem` estaban modelados en Prisma desde
el scaffold inicial (junto con `SaleStatus.RETURNED_PARTIAL`/`RETURNED_FULL`,
`StockMovementType.RETURN_IN`/`RETURN_OUT` y `AuditAction.RETURN_CREATED`), pero no habia use
case, repositorio, ruta ni controller -- `cancel-sale.use-case.ts` y el README de `suppliers` lo
referenciaban como si ya restaurara stock, documentacion adelantada a codigo que nunca se
escribio. Este modulo es el que efectivamente lo implementa.

## Que hace

`POST /returns` (permiso `return.create`, NO otorgado a CAJERO por defecto -- mismo criterio de
negocio que `sale.cancel`: reversar una venta requiere autorizacion de supervisor/admin) registra
una devolucion sobre una venta `COMPLETED` o `RETURNED_PARTIAL`:

1. Valida cada `saleItemId` contra los items reales de la venta -- nunca confia en
   precio/impuesto que venga del request, los recalcula desde el `SaleItem` guardado (mismo
   criterio que `create-sale.use-case.ts` usa `product.toProps.currentPrice`, no el precio del
   carrito).
2. Dentro de una unica transaccion Prisma (`PrismaReturnRepository.create`):
   - Valida que la cantidad devuelta (sumada a lo ya devuelto en devoluciones previas de la misma
     venta) no exceda lo vendido en cada `SaleItem` -- **dentro** de la transaccion, mismo
     criterio que `RegisterSupplierPaymentUseCase` usa para `amount <= balance`, para que dos
     devoluciones concurrentes del mismo item no se sobregiren.
   - Crea `Return` + `ReturnItem`.
   - Por cada item con `restockedToBranch = true` (el item es revendible): incrementa
     `ProductBranchStock`, crea `StockMovement` tipo `RETURN_IN` referenciando la devolucion, y si
     `Product.tracksBatches`, crea un **`Batch` nuevo** (no reinserta en el lote FIFO original
     consumido -- reconstruir a que lote exacto vuelve cada unidad devuelta es una regla de
     negocio propia sin definir en el alcance original, ver `suppliers/README.md` punto 1). El
     costo usado es el **promedio ponderado por cantidad** de las `StockMovement SALE_OUT`
     originales de esa venta/producto (no `Product.currentCost` actual, que pudo cambiar desde
     entonces por compras posteriores) -- desde la iteracion 23 una venta FIFO puede generar
     varias lineas `SALE_OUT` para el mismo producto (una por lote consumido), asi que se
     promedian todas (`findMany`), no se toma solo la primera. Tambien genera su fila de `Kardex`
     (`recordKardexEntry`, la misma funcion compartida que ya usan `PrismaSaleRepository` y
     `receiveGoods`).
   - Items con `restockedToBranch = false` (mercancia danada/no vendible): sin ningun efecto de
     inventario, pero igual cuentan para el tope de cantidad ya devuelta (ya se reembolso al
     cliente, no puede devolverse otra vez).
   - Deliberadamente **no** actualiza `Product.currentCost` -- restaurar una devolucion al mismo
     costo con el que salio no debe re-promediar el costo de productos no tocados.
   - Recalcula `Sale.status`: `RETURNED_FULL` si todos los `SaleItem` quedan con cantidad
     devuelta acumulada >= lo vendido, `RETURNED_PARTIAL` si algun item tiene devolucion > 0.
3. Contabiliza (`PostReturnJournalEntryUseCase`, modulo `accounting`): reverso en espejo de
   `PostSaleJournalEntryUseCase` -- debito Ingresos por ventas + IVA generado por el monto
   devuelto, credito Caja/Bancos/Clientes segun el `refundMethod` que se envia en el request
   (`CASH`/`CARD`/`TRANSFER`/`CREDIT_TO_ACCOUNT`). A proposito no se reconstruye la mezcla de
   pagos original de la venta -- un reembolso puede salir por un medio distinto al que se pago,
   asi que se pide explicito.
4. Audita `RETURN_CREATED`.

`GET /returns` (permiso `sale.read`, mismo que usa `credit-note`), filtro opcional `?saleId=`.

## Fuera de alcance (deliberado)

- **No crea `CashMovement` ni exige caja abierta**: el reembolso en efectivo queda contabilizado
  pero no mueve el arqueo de caja automaticamente -- responsabilidad operativa separada.
- **Lote nuevo en vez de restaurar el lote FIFO original** (ver punto 2 arriba) -- depende de que
  se resuelva primero el punto 1 de `suppliers/README.md` (trazabilidad de lote por linea de
  venta), que sigue pendiente.
- **Sin UI web todavia** -- backend + tests unicamente en esta iteracion, verificado en vivo
  contra Postgres local (venta completa, devolucion parcial y total, item no restockeado,
  producto con lotes, limite de cantidad excedida, permisos).
