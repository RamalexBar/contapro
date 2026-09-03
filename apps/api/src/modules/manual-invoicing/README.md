# Modulo: Factura manual (sin POS/producto)

Estado: `POST /manual-invoices` crea una factura con lineas de descripcion libre (sin `Product`,
sin sesion de caja, sin catalogo de inventario) para una empresa que solo quiere facturar (ver
`docs/PRECIOS.md`/comparativo con Alegra "solo facturacion"). Reusa el mismo motor de facturacion
electronica que las ventas del POS (`modules/electronic-invoicing`, ver su README seccion 14 y el
tipo `ElectronicInvoiceSource`) — no es un pipeline paralelo: `ElectronicInvoice.manualInvoiceId`
es la sexta entidad fuente posible de ese modulo (junto a Sale/CreditNote/DebitNote/Purchase/
PayrollDetail), con el mismo XOR contra `saleId` a nivel de base de datos.

## Implementado

1. `POST /manual-invoices` (permiso `sale.create`): recibe `branchId`, `customerId` opcional, y
   `items[]` (`description`, `quantity`, `unitPrice`, `taxPercent` — sin `productId`). Antes de
   crear nada, exige que el perfil fiscal de la empresa (`modules/company`, `GET /company/profile`)
   este completo — decision de producto: una empresa que solo va a facturar debe cargar sus datos
   DIAN primero, mismo criterio que el onboarding de Alegra que motivo esta feature.
2. Calcula subtotal/IVA/total por linea (mismas funciones puras que `CreateSaleUseCase`:
   `calculateTax`/`round2` de `@erp/shared-utils`), crea el registro `ManualInvoice` +
   `ManualInvoiceItem[]`, audita `MANUAL_INVOICE_CREATED`, y llama a
   `GenerateElectronicInvoiceUseCase.execute({ source: { type: "manual", manualInvoiceId }, ... })`
   en un try/catch no bloqueante (mismo patron que `CreateSaleUseCase`) — si la generacion falla,
   la factura manual queda creada igual, sin CUFE, recuperable via
   `POST /electronic-invoicing/manual-invoices/:id/resubmit`.
3. `GET /manual-invoices` / `GET /manual-invoices/:id` (permiso `sale.read`).
4. Consulta de la factura electronica generada (metadata, XML, PDF/RIDE, reenvio manual) via los
   endpoints ya existentes de `electronic-invoicing`, mismo patron que las ventas:
   `GET/POST /electronic-invoicing/manual-invoices/:manualInvoiceId[/xml|/pdf|/resubmit]`.

## Limitaciones conocidas (deliberadamente fuera de alcance de esta iteracion)

- **Sin asiento contable**: a diferencia de una venta del POS (`PostSaleJournalEntryUseCase`), una
  factura manual no contabiliza nada. Si se necesita mas adelante, seria un caso de uso nuevo
  reusando el `ChartOfAccounts`/`JournalEntry` existentes, no una reescritura de este modulo.
- **Sin cartera/cobranza**: no crea `AccountReceivable` ni se integra con `modules/collections` —
  no hay concepto de "pago" o "vencimiento" para una factura manual todavia, solo el documento y su
  representacion fiscal ante la DIAN.
- **Sin descuentos ni retenciones por linea**: a diferencia de `CreateSaleUseCase`, no hay
  `discountPercent` ni `SaleWithholding` — si se necesitan, agregarlos siguiendo el mismo patron
  que el POS.
- **Sin envio de RIDE por WhatsApp**: `SendInvoiceWhatsAppUseCase` sigue siendo exclusivo de
  ventas (`Sale.customerId`) — no se extendio a facturas manuales en esta iteracion.
