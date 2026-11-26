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

- ~~Sin asiento contable ni cartera~~ (resuelto 2026-11-24): `PostManualInvoiceJournalEntryUseCase` contabiliza
  Debito 1305 Clientes (o 1105 Caja si no tiene cliente) / Credito 4135, 2408 IVA y 240810 impuesto al consumo, y con
  cliente se crea la `AccountReceivable` (`manualInvoiceId`, vencimiento `dueDate`, 30 dias por defecto) que se abona
  en Cobranza. Las facturas de la API publica (POS externo) pasan `postAccounting: false`: su venta ya la contabiliza
  el cierre de turno, y hacerlo aqui duplicaria el ingreso. Si contabilizar falla (ej. mes cerrado), la factura queda
  creada y se audita `MANUAL_INVOICE_ACCOUNTING_FAILED`.
- **Sin descuentos ni retenciones por linea**: a diferencia de `CreateSaleUseCase`, no hay
  `discountPercent` ni `SaleWithholding` — si se necesitan, agregarlos siguiendo el mismo patron
  que el POS.
- **Sin envio de RIDE por WhatsApp**: `SendInvoiceWhatsAppUseCase` sigue siendo exclusivo de
  ventas (`Sale.customerId`) — no se extendio a facturas manuales en esta iteracion.

## Cliente nuevo desde la misma pantalla (2026-11-26)

En la web, el selector de cliente tiene "+ Nuevo cliente": documento, nombre, correo y **municipio (obligatorio)**.
Al crear la factura se crea primero el cliente (`POST /customers`) y la factura sale a su nombre. El municipio es
obligatorio porque Factus/DIAN rechazan la factura a nombre de un cliente sin codigo de municipio ("El campo codigo
municipio es obligatorio", visto en el sandbox); si se elige un cliente existente sin municipio, la pantalla avisa y no
deja crear la factura. Con una sola sucursal, queda elegida sola.
