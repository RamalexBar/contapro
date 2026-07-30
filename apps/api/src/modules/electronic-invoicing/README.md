# Modulo: Facturacion electronica DIAN

Estado: **generacion local de CUFE (SHA-384) y XML tipo UBL 2.1 por cada venta completada, con
numeracion DIAN real (resolucion/rango/consecutivo) consumida atomicamente e independiente del
consecutivo interno del POS. Firma XAdES y envio SOAP real a la DIAN NO implementados.**

## Modelos (`packages/database/prisma/schema/electronic-invoicing.prisma`)

- `InvoiceNumberingResolution` — rango de numeracion autorizado por la DIAN (prefijo, rango,
  consecutivo, vigencia), por empresa y opcionalmente por sucursal. Independiente de
  `Sale.number` (ticket POS por sucursal, no debe tocarse).
- `ElectronicInvoice` — un registro por venta facturada electronicamente: numero DIAN asignado,
  CUFE, datos del comprador, y el XML completo (`xmlContent`, texto). Enlazado 1:1 a `Sale`.

## Implementado

1. `POST /electronic-invoicing/numbering-resolutions` / `GET .../numbering-resolutions`:
   CRUD minimo de resoluciones DIAN (permiso `electronic-invoicing.manage` / `.read`).
2. Al completarse una venta —directamente en `CreateSaleUseCase`, o al autorizarse el ultimo
   descuento pendiente de una venta `PENDING_AUTHORIZATION` en `AuthorizeDiscountUseCase`—,
   justo despues de contabilizarla, se llama a `GenerateElectronicInvoiceUseCase`:
   - Reclama atomicamente el siguiente numero de la resolucion vigente para la sucursal (o la
     resolucion "toda la empresa" si no hay una especifica), en la misma transaccion que crea
     el `ElectronicInvoice` (`prisma-electronic-invoice.repository.ts`,
     `claimNumberAndGenerate`). El calculo del siguiente numero esta aislado en una funcion pura
     (`application/numbering-claim.ts`) con pruebas unitarias.
   - Genera el CUFE (`application/cufe-generator.ts`, SHA-384) y el XML
     (`application/ubl-invoice-xml-builder.ts`).
   - Actualiza `Sale.cufe` e `Sale.invoiceXmlUrl` (con la ruta de este modulo,
     `/api/electronic-invoicing/sales/{saleId}/xml`).
3. Ventas sin cliente (`Sale.customerId == null`, venta a "consumidor final") igual se
   facturan, usando la constante `DIAN_GENERIC_FINAL_CONSUMER`
   (`application/constants.ts`) — **valor sin verificar**, ver mas abajo.
4. Si la generacion falla (ej. no hay resolucion vigente para la sucursal), la venta **no** se
   bloquea: queda `COMPLETED` sin CUFE y se audita `ELECTRONIC_INVOICE_GENERATION_FAILED`
   (mismo criterio que la contabilizacion automatica de ventas, que tampoco bloquea la venta).
5. `GET /electronic-invoicing/sales/:saleId` (metadata) y `.../sales/:saleId/xml` (el XML
   crudo, `application/xml`) para consultar lo generado.
6. Auditoria: `INVOICE_NUMBERING_RESOLUTION_CREATED`, `ELECTRONIC_INVOICE_GENERATED`,
   `ELECTRONIC_INVOICE_GENERATION_FAILED`.

## Que falta implementar

1. Firma XAdES del XML (requiere certificado digital del emisor).
2. Envio SOAP real al servicio web de la DIAN. Las variables `DIAN_SOFTWARE_ID`,
   `DIAN_SOFTWARE_PIN`, `DIAN_TECHNICAL_KEY` y `DIAN_ENVIRONMENT` (ver `config/env.ts`) estan
   reservadas para esto — hoy **no se usan** para llamar a la DIAN, solo `DIAN_TECHNICAL_KEY` y
   `DIAN_ENVIRONMENT` entran en el calculo del CUFE (ver punto 4).
3. Validacion del XML contra el XSD oficial UBL 2.1 de la DIAN (hoy es un string armado a mano
   en `ubl-invoice-xml-builder.ts`, sin validar, sin bloque `ext:UBLExtensions`/firma).
4. **Verificar contra el Anexo Tecnico DIAN vigente** (marcado explicitamente en el codigo,
   no asumir que esta correcto):
   - El orden exacto de concatenacion del CUFE y el formato de decimales
     (`application/cufe-generator.ts`).
   - La lista completa de codigos de impuesto (hoy solo IVA/INC/ICA con montos de INC e ICA
     fijos en 0 desde `CreateSaleUseCase`, que no discrimina impuestos por tipo).
   - El tipo de documento/numero correcto para "consumidor final" (hoy aislado en
     `DIAN_GENERIC_FINAL_CONSUMER`, valor sin verificar).
5. Notas credito/debito electronicas (CUDE — `Sale.cude` queda sin usar en esta iteracion:
   aplica a otros tipos de documento DIAN, no a la factura de venta), reportes de eventos, PDF
   de representacion grafica (RIDE).
6. Flujo de regeneracion manual para ventas donde la generacion fallo (hoy solo queda el
   registro de auditoria `ELECTRONIC_INVOICE_GENERATION_FAILED`, sin un endpoint para reintentar).
