# Modulo: Facturacion electronica DIAN

Estado: **generacion local de CUFE/CUDE (SHA-384) y XML tipo UBL 2.1 por cada venta completada y
cada nota credito/debito que referencia una venta ya facturada, con numeracion DIAN real
(resolucion/rango/consecutivo por tipo de documento) consumida atomicamente e independiente del
consecutivo interno del POS. Si hay un certificado configurado (`DIAN_CERTIFICATE_PATH`), tambien
firma el XML con XAdES y lo encola para envio SOAP a la DIAN (poller en proceso, uno por tipo de
documento). Sin certificado configurado (el estado por defecto), el comportamiento es identico al
de antes: solo CUFE/CUDE + XML local, sin firma ni envio. El envio real a la DIAN NO esta
verificado contra su servicio real todavia (no hay credenciales de habilitacion reales, ver
"Limitaciones e items sin verificar").**

## Modelos (`packages/database/prisma/schema/electronic-invoicing.prisma`)

- `InvoiceNumberingResolution` — rango de numeracion autorizado por la DIAN (prefijo, rango,
  consecutivo, vigencia), por empresa, opcionalmente por sucursal, y por `documentType`
  (`FACTURA_VENTA` | `NOTA_CREDITO` | `NOTA_DEBITO` — la DIAN emite resoluciones separadas por
  tipo de documento en la vida real). Independiente de `Sale.number` (ticket POS por sucursal,
  no debe tocarse).
- `ElectronicInvoice` — un registro por venta facturada electronicamente: numero DIAN asignado,
  CUFE, datos del comprador, el XML sin firmar (`xmlContent`) y firmado (`signedXmlContent`), y
  el estado del envio a la DIAN (`status`, `dianTrackingId`, `dianResponseXml`,
  `rejectionReason`, `submittedAt`, `respondedAt`). Enlazado 1:1 a `Sale`.
- `ElectronicCreditNote` / `ElectronicDebitNote` — analogos a `ElectronicInvoice` para notas
  credito/debito: mismo shape, pero con `cude` en vez de `cufe` y un `referenceCufe` (el CUFE de
  la factura original que la nota afecta, obtenido via `Sale.electronicInvoice` de la venta
  referenciada). Enlazados 1:1 a `CreditNote`/`DebitNote`.

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
   - **Si `DIAN_CERTIFICATE_PATH` esta configurado**, ademas firma el XML (ver punto 4) y lo
     deja `PENDING_SUBMISSION` para que el poller lo envie.
3. Ventas sin cliente (`Sale.customerId == null`, venta a "consumidor final") igual se
   facturan, usando la constante `DIAN_GENERIC_FINAL_CONSUMER`
   (`application/constants.ts`) — **valor sin verificar**, ver mas abajo.
4. **Firma XAdES-BES** (`infrastructure/xades-xml-signer.ts`, sobre `xadesjs`/WebCrypto nativo de
   Node — no hizo falta `@peculiar/webcrypto`) y **carga de certificado PKCS#12**
   (`infrastructure/node-forge-certificate-loader.ts`, con `node-forge`). Probado con un
   certificado autofirmado generado en memoria (`infrastructure/__fixtures__/self-signed-cert.ts`):
   la firma verifica correctamente y el XML resultante es bien formado. **No** verificado contra
   XAdES-EPES/politica de firma de la DIAN ni contra su XSD oficial — ver limitaciones.
5. **Envio asincrono a la DIAN** (`infrastructure/dian-soap-client.ts`, sobres SOAP armados a
   mano + `fetch`, sin el paquete `soap`) y su maquina de estados
   (`application/use-cases/poll-dian-submissions.use-case.ts`, con pruebas usando un
   `IDianClient` falso): un poller en proceso (`infrastructure/dian-submission-poller.ts`,
   arrancado desde `server.ts` solo si hay certificado configurado) envia las facturas firmadas
   pendientes y consulta el estado de las ya enviadas, transicionando a `ACCEPTED`/`REJECTED`.
   **Esta parte NO esta probada contra la DIAN real** — ver limitaciones.
6. `POST /electronic-invoicing/sales/:saleId/resubmit`: reenvio manual para una factura
   `REJECTED` o que quedo sin firmar por un error transitorio (permiso `electronic-invoicing.manage`).
7. Si la generacion o la firma fallan, la venta **no** se bloquea: queda `COMPLETED` sin CUFE (o
   sin firmar) y se audita (`ELECTRONIC_INVOICE_GENERATION_FAILED` /
   `ELECTRONIC_INVOICE_SIGNING_FAILED`) — mismo criterio que la contabilizacion automatica de
   ventas, que tampoco bloquea la venta.
8. `GET /electronic-invoicing/sales/:saleId` (metadata) y `.../sales/:saleId/xml` (el XML firmado
   si existe, si no el sin firmar, `application/xml`).
9. Auditoria: `INVOICE_NUMBERING_RESOLUTION_CREATED`, `ELECTRONIC_INVOICE_GENERATED`,
   `ELECTRONIC_INVOICE_GENERATION_FAILED`, `ELECTRONIC_INVOICE_SIGNING_FAILED`,
   `ELECTRONIC_DOCUMENT_SUBMITTED`, `ELECTRONIC_DOCUMENT_ACCEPTED`, `ELECTRONIC_DOCUMENT_REJECTED`
   (estas 3 ultimas compartidas por factura/nota credito/nota debito — `entityType` en el
   registro distingue cual es cual).
10. **Notas credito/debito electronicas (CUDE)**: al emitir una nota credito/debito que
    referencia una venta (`saleId`) con factura electronica ya generada, `CreateCreditNoteUseCase`
    / `CreateDebitNoteUseCase` llaman a `GenerateElectronicCreditNoteUseCase` /
    `GenerateElectronicDebitNoteUseCase` (mismo patron try/catch no bloqueante que usan las
    ventas). Genera el CUDE (`application/cude-generator.ts`, con pruebas) referenciando el CUFE
    de la factura original, y el XML UBL (`application/ubl-note-xml-builder.ts`, compartido entre
    credito/debito ya que solo cambian el elemento raiz y el codigo de tipo). Si la nota **no**
    tiene `saleId`, o la venta referenciada aun no tiene factura electronica (sin certificado, o
    fallo su generacion), no se genera CUDE — la nota se emite igual, sin bloquear, y se audita
    `ELECTRONIC_CREDIT_NOTE_GENERATION_FAILED` / `ELECTRONIC_DEBIT_NOTE_GENERATION_FAILED`.
    Firma/envio/reenvio manual reusan exactamente la misma infraestructura que facturas
    (`IXmlSigner`, `IDianClient`, `PollDianSubmissionsUseCase`, el poller) via el puerto generico
    `IElectronicDocumentSubmissionRepository` — no hay una segunda maquina de estados duplicada.
    Endpoints: `GET/POST /electronic-invoicing/credit-notes/:creditNoteId[...]` y
    `.../debit-notes/:debitNoteId[...]`, mismos permisos que facturas.

## Como probar localmente sin credenciales DIAN

No hace falta un certificado real para ejercitar todo el camino de firma:

```
openssl req -x509 -newkey rsa:2048 -keyout test-key.pem -out test-cert.pem -days 365 -nodes -subj "/CN=Test DIAN Emisor/O=Test/C=CO"
openssl pkcs12 -export -out test-cert.p12 -inkey test-key.pem -in test-cert.pem -passout pass:test1234
```

Configurar en `.env`:
```
DIAN_CERTIFICATE_PATH="C:/ruta/a/test-cert.p12"
DIAN_CERTIFICATE_PASSWORD="test1234"
```

Con esto, cada venta completada queda `PENDING_SUBMISSION` con `signedXmlContent` poblado — la
firma es criptograficamente real y verificable, solo que el certificado no fue emitido por una
entidad certificadora colombiana reconocida por la DIAN. El poller intentara enviarla y fallara
(reintentando cada 30s) porque `DIAN_SOAP_ENDPOINT` sigue vacio — eso es lo esperado sin
credenciales de habilitacion reales.

## Limitaciones e items sin verificar (leer antes de un envio real)

1. **XAdES-BES vs EPES**: este modulo firma XAdES-BES. La DIAN ha exigido historicamente
   XAdES-**EPES** con un `SignaturePolicyId` especifico — **verificar el requisito vigente en el
   Anexo Tecnico antes de enviar a la DIAN real** (ver cabecera de `xades-xml-signer.ts`).
2. **Formato SOAP sin probar**: URL del servicio, nombres de operacion (`SendBillAsync`/
   `GetStatusZip`), forma de autenticacion, nombre de entrada del zip, y parseo de la respuesta
   en `dian-soap-client.ts` son la mejor comprension documentada publicamente, **no verificada**
   contra el WSDL/Anexo Tecnico vigente. Deliberadamente sin prueba automatizada (un mock ahi
   daria falsa confianza).
3. **Poller de una sola instancia**: `dian-submission-poller.ts` es un `setInterval` en memoria
   por instancia del proceso API. Si la API llega a correr en mas de una instancia (escalado
   horizontal), cada instancia enviaria/consultaria por su cuenta, duplicando envios. Aceptable
   para la etapa actual; antes de escalar horizontalmente esto necesita locking real (advisory
   lock de Postgres) o una cola — deliberadamente no implementado ahora.
4. Validacion del XML contra el XSD oficial UBL 2.1 de la DIAN (sigue sin hacerse).
5. **Verificar contra el Anexo Tecnico DIAN vigente**:
   - El orden exacto de concatenacion del CUFE y el formato de decimales
     (`application/cufe-generator.ts`).
   - La lista completa de codigos de impuesto (hoy solo IVA/INC/ICA con montos de INC e ICA
     fijos en 0 desde `CreateSaleUseCase`, que no discrimina impuestos por tipo).
   - El tipo de documento/numero correcto para "consumidor final" (`DIAN_GENERIC_FINAL_CONSUMER`).
6. **CUDE de notas (nuevo)**: el orden de concatenacion (`application/cude-generator.ts`) y los
   codigos de tipo de nota (`DIAN_NOTE_TYPE_CODE` en `application/constants.ts`, "91"/"92") son
   la misma clase de estimacion sin verificar que el CUFE — confirmar contra el Anexo Tecnico
   antes de un envio real. Documento soporte electronico (compras a no obligados a facturar) y
   PDF de representacion grafica (RIDE) siguen sin implementar.
7. `DIAN_SOFTWARE_ID`/`DIAN_SOFTWARE_PIN` se envian en el sobre SOAP tal como estan documentados
   publicamente, pero su ubicacion/formato exacto dentro del sobre esta sin confirmar.
