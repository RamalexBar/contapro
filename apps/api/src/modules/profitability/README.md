# Rentabilidad (2026-11-10)

`GET /reports/profitability?from=AAAA-MM-DD&to=AAAA-MM-DD&groupBy=product|category|customer&branchId=` (requiere
**accounting.read**). Responde, para cada grupo, unidades, venta neta sin IVA, costo real, utilidad y margen
(utilidad / venta × 100), más los totales.

- **Costo real = `SaleItem.costTotal`**, el costo PEPS de lo que efectivamente salió (ver
  `modules/inventory/stock/README.md`). Si una línea no lo tiene, se estima con el costo actual del producto y el
  reporte lo informa en `estimatedCostLines`.
- **Venta neta** = `SaleItem.total − taxAmount`, ya con descuentos.
- **Devoluciones:** se restan en la fecha en que se hicieron, con la venta proporcional de su línea. Si la mercancía
  volvió al inventario, también se resta su costo; si no volvió (se dañó), el costo se queda cargado a la venta.
- Entran las ventas `COMPLETED`, `RETURNED_PARTIAL` y `RETURNED_FULL`, filtradas por la fecha de la venta.
- Las ventas sin cliente aparecen como "Consumidor final"; los productos sin categoría, como "Sin categoria".

El cálculo está en `application/build-profitability-report.ts`, una función pura con pruebas. La lectura está en
`infrastructure/prisma-profitability.reader.ts`. En la web: Inventario → **Rentabilidad**, con exportación a Excel.

El Dashboard (utilidad estimada del mes) también usa ahora `costTotal` y la venta sin IVA. Antes usaba el costo
actual y el total con IVA.
