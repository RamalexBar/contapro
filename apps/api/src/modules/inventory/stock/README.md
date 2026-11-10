# Inventario: movimientos, costeo PEPS, kardex y reportes

## Costeo PEPS para todos los productos (2026-11-10)

Antes el costo era promedio ponderado y PEPS solo funcionaba si el producto tenía `costMethod = FIFO` **y**
`tracksBatches` (ninguna pantalla permitía activarlo). Además, con promedio, el `StockMovement` de salida guardaba el
**precio de venta** como costo, así que no había forma de sacar una utilidad real.

Ahora **todo** producto se costea por PEPS: se vende primero lo que entró antes. Ejemplo: compras 10 bombones a $250
en enero y 10 a $300 en marzo, y vendes 12. El costo de esa venta es 10 × $250 + 2 × $300 = $3.100; quedan 8 a $300.

- **Capas de costo = `Batch`.** Toda entrada crea una capa con su cantidad y su costo: compra (`receiveGoods`),
  entrada manual, existencias iniciales al crear el producto, ajuste a favor (al costo vigente), traslado (llega con
  el mismo costo y la misma antigüedad que tenía en la otra sucursal) y devolución de un cliente (vuelve con el costo
  con que salió y con la antigüedad de la capa más vieja que consumió esa venta, así que sale de nuevo primero).
  `tracksBatches` ahora solo decide si se piden número de lote y vencimiento.
- **Salidas** (venta, ajuste en contra, traslado, anulación de compra) consumen las capas de la más vieja a la más
  nueva y crean **un `StockMovement` por capa tocada**, con su costo real. La anulación de una compra saca primero las
  capas que entraron a ese mismo costo.
- **Todo pasa por `infrastructure/cost-layers.ts`** (`addCostLayer`, `consumeCostLayers`, `refreshCurrentCost`); la
  regla pura está en `domain/fifo-cost.ts`, con sus pruebas.
- **`Product.currentCost`** = costo de la capa más vieja con saldo en cualquier sucursal (el costo de la próxima unidad
  en salir). Si no queda ninguna capa, conserva el último costo conocido.
- **Venta sin existencias:** no se bloquea. Lo que no cubre ninguna capa sale al `currentCost` vigente, y la siguiente
  entrada primero "tapa" ese faltante: solo el resto queda como capa (`layerQuantityForEntry`). Así las capas nunca
  suman más que las existencias reales.
- **`SaleItem.costTotal`** guarda el costo real de cada línea vendida, fijado al completar la venta. Es la base del
  reporte de rentabilidad y del costo de venta del asiento contable.
- **Migración `20261110120000_fifo_cost_layers`:** pasa todos los productos a FIFO, crea una capa `SALDO-INICIAL` con
  las existencias que no tenían lote (valorizadas al `currentCost` de ese momento) y rellena `costTotal` de las ventas
  anteriores (con el costo real del lote si la venta ya era FIFO con lotes; si no, una estimación con `currentCost`).

### Limitaciones conocidas

- **Una devolución de cliente vuelve al costo promedio de su línea de venta** (`costTotal / cantidad`), no al costo de
  la capa exacta de cada unidad. Si la línea consumió dos capas, lo devuelto queda con un costo intermedio.
- **Anular una venta** sigue sin reintegrar mercancía; se hace con una devolución (limitación previa de
  `CancelSaleUseCase`).
- **`AVERAGE`/`LAST` siguen en el enum `CostMethod`** solo por compatibilidad: ya no cambian el cálculo.
- **El inventario valorizado es a hoy**, no a una fecha pasada (las capas guardan el saldo actual).

## Kardex

Una fila por `StockMovement` (`kardex-writer.ts`). Desde PEPS: `balanceCost` es el valor real de las capas que quedan
en la sucursal, y `averageCost` es `balanceCost / balanceQty`. `GET /kardex` devuelve además `movementUnitCost`, el
costo real de cada movimiento. Cada segmento de una salida se registra con su saldo intermedio.

## Reportes

- `GET /stock/valuation?branchId=` (**accounting.read**, porque muestra costos): inventario valorizado por
  producto/sucursal, con el detalle de sus capas (cuántas unidades quedan a cada costo).
- `GET /stock/alerts?branchId=` (product.read): productos agotados o bajo su `minStock`, con cuánto pedir para volver
  al `maxStock` (o al mínimo si no hay máximo).
- Rentabilidad: módulo `modules/profitability`.

En la web: Inventario → **Alertas de stock**, **Inventario valorizado** y **Rentabilidad**. Las dos últimas solo se
ven con `accounting.read`.
