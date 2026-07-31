# Modulo: Proveedores / Compras

Estado: **CRUD de proveedores, orden de compra (crear -> enviar -> recibir parcial/total),
recepcion de mercancia con impacto real en inventario (stock, lotes, costo), registro directo de
factura de compra (con contabilizacion automatica), abonos a cuentas por pagar (con su propio
comprobante contable) y cancelacion de una compra sin abonos, todo implementado.**

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
   el comprobante contable (`VoidJournalEntryUseCase`, generico, reusado tal cual). **Alcance
   recortado a proposito**: solo permite cancelar si la cuenta por pagar todavia no tiene abonos
   (`balance === amount`) — si ya tiene abonos, responde `409 CONFLICT` y no hace nada; reversar
   abonos parciales es un problema mas grande, no implementado.
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
     - `FIFO`: **no tiene consumo real implementado** (eso requeriria cambios del lado de las
       VENTAS — consumir lotes en orden de entrada — fuera de alcance de este modulo). Mientras
       tanto se calcula igual que `AVERAGE`, para no inventar una formula sin verificar. Ver
       tambien `docs/ALCANCE.md`.
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
   `PURCHASE_CANCELLED`.

## Que falta implementar

1. Reversar abonos parciales para poder cancelar una compra que ya tiene pagos (hoy responde
   `409 CONFLICT`).
2. Consumo FIFO real (orden de las ventas) — `Batch`/`Kardex`/`Product.costMethod` ya soportan el
   dato de entrada por lote, pero nada lo consume en orden todavia.
3. Poblar `Kardex` (historial de saldos) — el modelo existe, preparado, sin usar todavia; no era
   parte del checklist de este trabajo (recepcion de mercancia), es trabajo de reportes aparte.
4. UI web (este modulo, como Contabilidad, solo tiene API por ahora).
