# Modulo: Proveedores / Compras

Estado: **CRUD de proveedores, orden de compra (crear -> enviar -> recibir parcial/total),
recepcion de mercancia con impacto real en inventario (stock, lotes, costo), registro directo de
factura de compra (con contabilizacion automatica), abonos a cuentas por pagar (con su propio
comprobante contable, reversables al cancelar) y cancelacion de una compra con o sin abonos, todo
implementado. Consumo FIFO real (modulo POS) documentado abajo.

## Modelos (`packages/database/prisma/schema/suppliers.prisma`)

- `Supplier` — datos del proveedor (NIT, contacto).
- `PurchaseOrder` + `PurchaseOrderItem` — orden de compra. `PurchaseOrderItem` no tiene una
  columna de "cantidad recibida": se deriva agregando `GoodsReceiptItem` de todas las recepciones
  hechas contra la orden (`IPurchaseOrderRepository.findByIdOrThrow`).
- `GoodsReceipt` + `GoodsReceiptItem` — recepcion de mercancia, opcionalmente ligada a una
  `PurchaseOrder` (`purchaseOrderId` nullable — tambien se puede recibir mercancia sin orden
  previa).
- `Purchase` — factura de compra. Tiene `subtotal`/`taxTotal`/`total` y `journalEntryId` (guarda
  el comprobante contable que la registro, para poder anularlo si la compra se cancela).
  **`PurchaseOrder`/`GoodsReceipt` y `Purchase` NO se enlazan entre si** (sin FK cruzada) — son
  flujos paralelos que comparten solo `supplierId`: recibir mercancia impacta inventario,
  registrar la factura impacta lo financiero, cada uno independiente.
- `AccountPayable` + `SupplierPayment` — cuentas por pagar y sus abonos.

## Implementado

1. CRUD basico de proveedores: `POST /suppliers` y `GET /suppliers` (permiso `suppliers.manage`
   / `suppliers.read`).
2. `POST /purchases`: registra una factura de compra directamente (sin pasar por orden de
   compra ni recepcion de mercancia), crea su `AccountPayable` a termino completo y genera y
   contabiliza el comprobante correspondiente
   (`modules/accounting/application/use-cases/post-purchase-journal-entry.use-case.ts`):
   debito Inventario + IVA descontable, credito Proveedores nacionales. Guarda el id del
   comprobante en `Purchase.journalEntryId`.
3. `POST /purchases/:id/cancel`: marca la compra y su `AccountPayable` como `CANCELLED` y anula
   el comprobante contable (`VoidJournalEntryUseCase`, generico, reusado tal cual). Si la cuenta
   por pagar ya tiene abonos (iteracion 16), primero los reversa (ver punto 9) antes de
   cancelar la compra.
4. Orden de compra: `POST /purchase-orders` (crea en `DRAFT`, total calculado del lado del
   servidor sumando `quantity*unitCost` por item — a diferencia de `Purchase`, que refleja una
   factura externa con su propio total a reconciliar), `GET /purchase-orders`,
   `GET /purchase-orders/:id` (incluye `receivedQuantity` por item), `POST
   /purchase-orders/:id/send` (`DRAFT -> SENT`).
5. Recepcion de mercancia: `POST /goods-receipts` (`receiveGoods.use-case.ts`) crea el
   `GoodsReceipt` y, por cada item, llama a `IStockRepository.receiveGoods` (nuevo metodo en
   `modules/inventory/stock`) que:
   - Suma la cantidad en `ProductBranchStock` de la sucursal que recibe.
   - Crea un `StockMovement` tipo `PURCHASE_IN` referenciando el `GoodsReceipt` de origen.
   - Crea un `Batch` si `Product.tracksBatches` (con `expirationDate`/`batchNumber` si vienen).
   - Recalcula `Product.currentCost` segun `Product.costMethod`:
     - `AVERAGE` (default): **promedio ponderado real** contra las existencias previas en TODAS
       las sucursales (`Product.currentCost` es un solo valor por toda la empresa, no por
       sucursal) — `(cantidadPrevia*costoActual + cantidadRecibida*costoRecibido) /
       (cantidadPrevia+cantidadRecibida)`.
     - `LAST`: se fija al costo del ultimo recibo, sin ponderar.
     - `FIFO`: el calculo de ENTRADA (este paso, al recibir mercancia) se sigue haciendo igual
       que `AVERAGE` a proposito -- `Product.currentCost` es un valor agregado usado tambien
       fuera de FIFO (transferencias, ajustes), no tiene sentido que sea "el costo del proximo
       lote" hasta que efectivamente se consuma. El consumo real (agotar lotes en orden de
       entrada al vender) esta en el modulo POS, ver punto 8 mas abajo.
   - **Hallazgo corregido**: antes de este trabajo, ninguna entrada de stock (ni siquiera la
     entrada manual, `RegisterStockEntryUseCase`) actualizaba `Product.currentCost` — el campo
     solo se movia a mano via `UpdateProductPriceUseCase`. Este es el primer codigo que calcula
     costo promedio real.
   - Si la recepcion referencia una `PurchaseOrder`, recalcula su estado comparando cantidad
     recibida acumulada vs pedida por item: `RECEIVED` si todo esta completo, `PARTIALLY_RECEIVED`
     si algo si y algo no.
   - **Limitacion conocida**: crear el `GoodsReceipt` y aplicar el impacto en inventario son dos
     llamadas separadas (no una transaccion distribuida) — mismo criterio que ya acepta este
     codebase para `CreatePurchaseUseCase`/contabilizacion. Si el segundo paso falla, el
     `GoodsReceipt` ya quedo creado sin impacto en stock.
   - `GET /goods-receipts`, `GET /goods-receipts/:id`.
6. Abonos: `GET /accounts-payable` (filtro opcional `?status=`), `POST
   /accounts-payable/:id/payments` (`RegisterSupplierPaymentUseCase`) — valida `amount <= balance`
   **dentro de la transaccion** (mismo criterio que `PrismaStockMovementRepository.adjust()` usa
   para no dejar el inventario en negativo, evita que dos abonos concurrentes sobregiren el
   saldo), actualiza `balance`/`status` (`PARTIAL`/`PAID`), crea el `SupplierPayment`, y
   contabiliza (`PostSupplierPaymentJournalEntryUseCase`, accounting): debito Proveedores
   nacionales, credito Caja general (metodo `CASH`) o Bancos (cualquier otro metodo).
7. Auditoria: `SUPPLIER_CREATED`, `PURCHASE_REGISTERED`, `PURCHASE_ORDER_CREATED`,
   `PURCHASE_ORDER_SENT`, `GOODS_RECEIPT_REGISTERED`, `SUPPLIER_PAYMENT_REGISTERED`,
   `PURCHASE_CANCELLED`, `SUPPLIER_PAYMENT_REVERSED` (iteracion 16).
8. UI web (proveedores, compras, ordenes de compra) agregada en la iteracion 13.
9. **Reversar abonos al cancelar una compra** (iteracion 16, `cancel-purchase.use-case.ts`):
   `SupplierPayment` ahora tiene `status` (`REGISTERED`/`REVERSED`, migracion
   `20260731203916_add_supplier_payment_status`). Si `AccountPayable.balance !== amount` al
   cancelar, `IAccountPayableRepository.reverseAllPayments` marca `REVERSED` todos los abonos
   activos y restaura `balance = amount` / `status = PENDING` en una transaccion; luego, por
   cada abono reversado, se busca su comprobante contable via el nuevo
   `IJournalEntryRepository.findBySource("SupplierPayment", paymentId)` (los abonos no guardaban
   el id del comprobante como si lo hace `Purchase.journalEntryId`, asi que se ubica por
   `sourceType`/`sourceId`, igual que ya hacia `PostSupplierPaymentJournalEntryUseCase` al
   crearlo) y se anula con `VoidJournalEntryUseCase`. No reversa dinero real de caja/banco, solo
   anula los comprobantes -- igual alcance que ya tenia la cancelacion del comprobante de la
   compra misma.
10. **Retenciones al proveedor (RteFuente/ReteICA/ReteIVA)** (item 29 de `docs/ALCANCE.md`,
    conceptos definidos en `modules/accounting`, ver su README para el detalle completo):
    `POST /purchases` acepta `withholdings: [{withholdingConceptId, base}]`; `Purchase` gana
    `retentionTotal` + la relacion `PurchaseWithholding` (tarifa snapshoteada al aplicarse). El
    cambio real está en `PrismaPurchaseRepository.create()`: el `AccountPayable` que se crea
    queda **neto de retencion** desde el inicio (`amount`/`balance` = `total - retentionTotal`)
    -- por eso `RegisterSupplierPaymentUseCase` y la reversa de abonos del punto 9 de arriba no
    necesitaron ningun cambio, ya operaban solo sobre `AccountPayable.balance`. Verificado en
    vivo: compra con ReteICA, `AccountPayable` neto correcto, abono contra ese saldo neto, y
    cancelacion con reverso completo del abono y del comprobante -- los tres sin tocar código.

## Consumo FIFO real (iteracion 16, `modules/pos/sale`)

`PrismaSaleRepository.applyCompletionSideEffects` (unico punto donde una venta completada
descuenta stock, ya sea al crearse `COMPLETED` de entrada o al autorizarse el ultimo descuento
pendiente) ahora distingue por producto:

- Si `Product.costMethod === "FIFO"` **y** `Product.tracksBatches`: consume los `Batch` del
  producto/sucursal en orden de entrada (`createdAt` asc) hasta cubrir la cantidad vendida,
  decrementando cada lote tocado. El `StockMovement` `SALE_OUT` de esa linea de venta guarda el
  **costo real ponderado** de los lotes consumidos (antes se guardaba `item.unitPrice` -- el
  precio de venta, no el costo -- para TODOS los metodos de costeo; ese comportamiento previo
  sigue igual para `AVERAGE`/`LAST`, solo se corrigio para `FIFO`). Actualiza
  `Product.currentCost` al costo del lote mas antiguo que quede disponible tras el consumo (el
  "proximo costo a vender" bajo FIFO); si no queda ninguno, lo deja igual.
- Si no hay lotes suficientes para cubrir toda la cantidad (drift entre `Batch` y
  `ProductBranchStock` por ajustes/transferencias que no tocan `Batch`), el remanente se valora
  al ultimo `Product.currentCost` conocido en vez de bloquear la venta -- este remanente tambien
  genera su propio segmento/linea (ver punto siguiente), con `batchId: null`.
- Sin `tracksBatches` (aunque `costMethod = FIFO`), no hay datos de lote para trabajar -- se
  mantiene el comportamiento anterior sin cambios (una sola linea, `batchId: null`).
- **Una linea de `StockMovement` (y su `Kardex`) por cada lote realmente consumido** (iteracion
  23, antes una sola linea agregada por item de venta): `consumeFifoBatches` devuelve un arreglo
  de segmentos (`{ batchId, quantity, unitCost }`, uno por `Batch` tocado en orden de entrada, mas
  el remanente sin lote si aplica) en vez de un solo costo ponderado; `applyCompletionSideEffects`
  crea un `StockMovement` (con `batchId` real) y decrementa `ProductBranchStock` por cada segmento,
  en vez de una decrementacion agregada + una sola linea. `Kardex` queda con saldo verdaderamente
  decreciente por cada lote consumido de una misma venta, no una sola foto del saldo final.
  **Efecto secundario que hubo que corregir**: el modulo de Devoluciones (`modules/pos/return`)
  buscaba el costo original de la venta con `stockMovement.findFirst` sobre
  `referenceType/referenceId/productId` -- con esta iteracion una venta FIFO puede generar varias
  lineas `SALE_OUT` para el mismo producto, asi que `findFirst` podia devolver el costo de un solo
  lote en vez del promedio real; se cambio a `findMany` + promedio ponderado por cantidad (ver
  `PrismaReturnRepository.create`). Verificado en vivo que una devolucion sobre una venta que
  consumio 3 lotes distintos (1@1000 + 2@1200 + 1@1500 = 4 unidades) reingresa al costo promedio
  correcto (1225), no al costo de un solo lote.
- **No se reversa** el consumo de lotes si la venta se anula despues (`CancelSaleUseCase`) --
  misma limitacion ya documentada ahi: el modulo de Devoluciones es el que ajusta stock
  explicitamente.

## Kardex (historial de saldos, iteracion 21, `modules/inventory/stock`)

El modelo `Kardex` vivia sin usar en el schema desde el scaffold inicial. Ahora cada
`StockMovement` que se crea en el sistema (los 6 puntos de escritura: entrada manual
`RegisterStockEntryUseCase`, ajuste `AdjustStockUseCase`, traslado `TransferStockUseCase` (dos
movimientos, uno por sucursal), recepcion de mercancia `receiveGoods` (este README, punto 5), alta
de producto con stock inicial (`modules/inventory/product`) y venta completada (`modules/pos/sale`,
`SALE_OUT`) — genera tambien su fila de `Kardex`, dentro de la MISMA transaccion Prisma que crea el
movimiento (`kardex-writer.ts`, funcion compartida `recordKardexEntry`).

- `GET /kardex?productId=&branchId=&from=&to=` (permiso `product.read`, reusado -- es un reporte
  de solo lectura sobre un producto, no una accion nueva que necesite su propio permiso).
- Cada fila guarda el saldo **resultante** del movimiento: `balanceQty` (saldo de
  `ProductBranchStock` de esa sucursal/producto despues del movimiento), `averageCost` (una foto
  de `Product.currentCost` en ese momento -- costo promedio ponderado, unico por empresa, no por
  sucursal) y `balanceCost = balanceQty * averageCost`. La respuesta tambien incluye
  `movementType`/`movementQuantity` (resueltos con una segunda consulta contra `StockMovement`,
  ya que `Kardex.movementId` es una referencia suelta, sin relacion de Prisma) para que cada fila
  tenga contexto de que la origino.
- **Simplificacion deliberada**: `averageCost` no se recalcula un promedio nuevo en cada fila,
  simplemente refleja `Product.currentCost` en ese instante. Para movimientos que ya recalculan
  ese campo (recepcion de mercancia con `costMethod = AVERAGE`, consumo FIFO en una venta) el
  Kardex queda exacto; para los que no lo tocan (entrada manual, ajustes, traslados) la fila
  refleja el costo que ya tenia el producto, igual que el resto de la app ya asume en esos flujos
  -- no se invento una formula de promedio por sucursal que no existe en ningun otro lado del
  codebase.
- Verificado en vivo end-to-end: entrada manual, ajuste negativo, recepcion de mercancia
  (confirmando el nuevo promedio ponderado recalculado), venta, filtro por fecha (`from`), y
  permiso (`product.read`, ya lo tiene CAJERO). El traslado entre sucursales se revisó por
  lectura de código (mismo patrón que los demás sitios, ya verificados) pero no se probó en vivo
  porque los datos de la empresa demo solo tienen una sucursal.

## Que falta implementar

1. ~~`StockMovement` por lote consumido en una venta FIFO (para trazabilidad fina)~~ --
   implementado en la iteracion 23 (ver seccion "Consumo FIFO real" arriba): cada lote consumido
   en una venta ahora genera su propia linea de `StockMovement`/`Kardex`. Sigue pendiente: `Return`
   sigue creando un lote nuevo en vez de reinsertar en el lote FIFO original exacto -- esto ya es
   posible en principio (ahora se sabe que lote salio en cada linea), pero no se implemento en
   esta iteracion porque una devolucion puede mezclar cantidades de varios `SaleItem`/lineas de
   venta distintas y reconstruir "a que lote exacto vuelve cada unidad devuelta" es una regla de
   negocio propia (ej. Ultimo Entra Primero Sale al devolver vs. reinsertar en el lote de origen)
   que no estaba definida en el alcance original.
2. ~~Devoluciones (`Return`) no restaura lotes especificos al recibir mercancia de vuelta~~ --
   implementado en la iteracion 22 (`modules/pos/return`, ver su README): ahora existe el modulo
   completo (antes no existia en absoluto, a pesar de que este README y `cancel-sale.use-case.ts`
   lo mencionaban como si ya funcionara). Restaura stock y contabiliza, pero crea un **lote
   nuevo** en vez de reinsertar en el lote FIFO original consumido (ver punto 1).
