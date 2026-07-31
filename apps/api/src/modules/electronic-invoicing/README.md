# Modulo: Facturacion electronica DIAN

Estado: **generacion local de CUFE/CUDE/CUDS/CUNE (SHA-384) y XML por cada venta completada, cada
nota credito/debito que referencia una venta ya facturada, cada compra a un proveedor no obligado
a facturar electronicamente, y cada empleado de cada nomina aprobada, con numeracion DIAN real
(resolucion/rango/consecutivo por tipo de documento, salvo nomina — ver punto 12) consumida
atomicamente e independiente del consecutivo interno del POS. Si hay un certificado configurado
(`DIAN_CERTIFICATE_PATH`), tambien firma el XML con XAdES y lo encola para envio SOAP a la DIAN
(poller en proceso, uno por tipo de documento). Sin certificado configurado (el estado por
defecto), el comportamiento es identico al de antes: solo CUFE/CUDE/CUDS/CUNE + XML local, sin
firma ni envio. El envio real a la DIAN NO esta verificado contra su servicio real todavia (no hay
credenciales de habilitacion reales, ver "Limitaciones e items sin verificar"). **La nomina
electronica es, con diferencia, la parte MENOS verificada de todo el modulo** — esquema XML propio
(no UBL) sin contrastar contra el Anexo Tecnico, servicio SOAP distinto al de facturacion sin
confirmar ni en nombre, ver punto 12 y las limitaciones al final. El documento soporte (compras)
es la segunda parte menos verificada, ver mas abajo.

## Modelos (`packages/database/prisma/schema/electronic-invoicing.prisma`)

- `InvoiceNumberingResolution` — rango de numeracion autorizado por la DIAN (prefijo, rango,
  consecutivo, vigencia), por empresa, opcionalmente por sucursal, y por `documentType`
  (`FACTURA_VENTA` | `NOTA_CREDITO` | `NOTA_DEBITO` | `DOCUMENTO_SOPORTE` — la DIAN emite
  resoluciones separadas por tipo de documento en la vida real). Independiente de `Sale.number`
  (ticket POS por sucursal, no debe tocarse).
- `ElectronicInvoice` — un registro por venta facturada electronicamente: numero DIAN asignado,
  CUFE, datos del comprador, el XML sin firmar (`xmlContent`) y firmado (`signedXmlContent`), y
  el estado del envio a la DIAN (`status`, `dianTrackingId`, `dianResponseXml`,
  `rejectionReason`, `submittedAt`, `respondedAt`). Enlazado 1:1 a `Sale`.
- `ElectronicCreditNote` / `ElectronicDebitNote` — analogos a `ElectronicInvoice` para notas
  credito/debito: mismo shape, pero con `cude` en vez de `cufe` y un `referenceCufe` (el CUFE de
  la factura original que la nota afecta, obtenido via `Sale.electronicInvoice` de la venta
  referenciada). Enlazados 1:1 a `CreditNote`/`DebitNote`.
- `ElectronicSupportDocument` — documento soporte por cada compra a un `Supplier` con
  `isObligatedToInvoice=false`: mismo shape que los anteriores, con `cuds` en vez de
  `cufe`/`cude` y **sin** campo de referencia (a diferencia de las notas, el documento soporte
  no afecta un documento previo — es el documento original de esa compra). Enlazado 1:1 a
  `Purchase`.
- `ElectronicPayroll` — nomina electronica, **estructuralmente distinta** a los otros 4 (ver punto
  12): `cune` en vez de `cufe`/`cude`/`cuds`, sin `numberingResolutionId` (usa
  `Company.payrollElectronicSequence`, un contador simple, no una resolucion DIAN — sin verificar
  que esto sea correcto), y enlazado 1:1 a `PayrollDetail` (el registro **por empleado**, no a
  `Payroll` que es el periodo completo) porque la DIAN exige un documento por empleado por
  periodo.

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
11. **Documento soporte electronico (compras, CUDS)**: `Supplier` gano el campo
    `isObligatedToInvoice` (default `true`). Al registrar una compra (`CreatePurchaseUseCase`)
    contra un proveedor marcado `false`, se llama a `GenerateElectronicSupportDocumentUseCase`
    (mismo patron try/catch no bloqueante). Genera el CUDS
    (`application/cuds-generator.ts`, con pruebas — sin campo de referencia) y el XML
    (`application/ubl-support-document-xml-builder.ts`, con los roles de comprador/vendedor
    **invertidos** respecto a facturas: `AccountingSupplierParty` = el proveedor,
    `AccountingCustomerParty` = la propia empresa, porque quien emite el documento es la empresa
    actuando en nombre del proveedor que no puede facturar). Compras contra proveedores sin
    marcar (el caso comun, default `true`) no generan nada. Reusa la misma infraestructura de
    firma/envio/reenvio que facturas y notas. Endpoints:
    `GET/POST /electronic-invoicing/purchases/:purchaseId[...]`. **Esta es la segunda parte menos
    verificada de todo el modulo (despues de nomina) — ver limitaciones.**
12. **Nomina electronica (CUNE)** — la Resolucion 000013 de 2021 define un tipo de documento DIAN
    estructuralmente distinto a los 4 anteriores (todos UBL, mismo servicio DIAN): esquema XML
    **propio, no UBL**, codigo unico **CUNE** (no CUFE/CUDE/CUDS), y un **servicio web DIAN
    separado**. `Employee` gano `middleName`/`secondLastName`/`workerType`/`workerSubtype`
    (campos que la DIAN exige y que no existian). Al aprobar una nomina (`ApprovePayrollUseCase`,
    despues de contabilizarla — ese paso sigue bloqueante, sin cambios), se itera cada
    `PayrollDetail` (un empleado) y se llama a `GenerateElectronicPayrollUseCase` por cada uno, en
    su propio try/catch — un empleado fallando no frena a los demas ni bloquea la aprobacion
    (`ELECTRONIC_PAYROLL_GENERATION_FAILED` si falla). Genera el CUNE
    (`application/cune-generator.ts`, con pruebas — la formula de concatenacion es, de los 4
    generadores, la que menos documentacion publica tiene para contrastar) y el XML
    (`application/dian-payroll-xml-builder.ts`, **no UBL**, estructura best-effort con bloques
    `Empleador`/`Trabajador`/`Periodo`/`Devengados`/`Deducciones`/`ComprobanteTotal` — tratar como
    placeholder mas aun que el de documento soporte). La retencion en la fuente se envia fija en
    `0.00`: el motor de calculo de nomina actual no la calcula, no se inventa un valor. El envio
    usa `DianNominaSoapClient` (`infrastructure/dian-nomina-soap-client.ts`), una clase separada
    de `DianSoapClient` con su propio endpoint (`DIAN_NOMINA_SOAP_ENDPOINT`) porque es un servicio
    DIAN distinto — ni siquiera los nombres de operacion (`SendNominaAsync`/`GetStatusNomina`)
    estan confirmados publicamente, a diferencia del de facturacion. Todo lo demas (firma XAdES,
    maquina de estados, poller, reenvio manual) reusa el motor generico existente sin cambios.
    Endpoints: `GET/POST /electronic-invoicing/payroll-details/:payrollDetailId[...]`. **No
    confundir con el desprendible de pago** (`GET /payslips/:id/pdf`, `modules/payroll`,
    iteracion 14): ese es el comprobante interno que recibe el empleado y funciona para cualquier
    periodo calculado, sin depender de que la nomina se haya facturado electronicamente ante la
    DIAN; el RIDE de aqui (punto 13) es el comprobante fiscal, solo existe si el CUNE se genero.
13. **RIDE (representacion grafica en PDF)** — los 5 tipos de documento ahora tienen un endpoint
    `GET .../{sales/:saleId, credit-notes/:creditNoteId, debit-notes/:debitNoteId,
    purchases/:purchaseId, payroll-details/:payrollDetailId}/pdf` que devuelve un PDF (`pdfkit`,
    Node puro, sin navegador headless — mismo criterio que el resto del modulo de no depender de
    runtimes pesados). Un solo layout compartido
    (`infrastructure/pdfkit-ride-renderer.ts`) sirve a los 5 tipos; cada uno tiene su propia
    funcion adaptadora en `application/ride-data-mapper.ts`
    (`mapInvoiceToRideData`/`mapNoteToRideData`/`mapSupportDocumentToRideData`/
    `mapPayrollToRideData`). El emisor, la contraparte (comprador/proveedor/trabajador), los
    totales y las lineas **se parsean del `xmlContent` ya guardado** en vez de volver a consultar
    `Sale`/`Purchase`/`Product` — los tipos de dominio `Electronic*Record` son deliberadamente
    minimos (numero, codigo unico, estado) y no duplican esos datos, así que el XML es la unica
    fuente disponible sin acoplar este modulo a otros (`application/xml-document-extractor.ts`,
    con pruebas). Sin logo de empresa en esta version (evita I/O de red durante el render). Con
    `DIAN_ENVIRONMENT=HABILITACION` (el default) el PDF lleva una marca de agua diagonal
    "HABILITACION - NO VALIDO COMO DOCUMENTO FISCAL". **Ver limitaciones**: el formato del QR y el
    layout en si no estan validados contra el Anexo Tecnico DIAN vigente, y el documento soporte
    no tiene desglose de lineas (hereda el hueco de su XML, ver punto 8).

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
6. **CUDE de notas**: el orden de concatenacion (`application/cude-generator.ts`) y los
   codigos de tipo de nota (`DIAN_NOTE_TYPE_CODE` en `application/constants.ts`, "91"/"92") son
   la misma clase de estimacion sin verificar que el CUFE — confirmar contra el Anexo Tecnico
   antes de un envio real.
7. `DIAN_SOFTWARE_ID`/`DIAN_SOFTWARE_PIN` se envian en el sobre SOAP tal como estan documentados
   publicamente, pero su ubicacion/formato exacto dentro del sobre esta sin confirmar.
8. **Documento soporte (CUDS) — la parte MENOS verificada de todo el modulo**:
   - El **esquema XML** en `application/ubl-support-document-xml-builder.ts` reutiliza la forma
     UBL "Invoice" como aproximacion (mismo `InvoiceTypeCode` "05" que se cita habitualmente para
     este tipo de documento, pero sin confirmar contra el XSD/Anexo Tecnico real de documento
     soporte, que probablemente no sea identico al de factura). Tratar como placeholder.
   - El orden de concatenacion del CUDS (`application/cuds-generator.ts`) tiene aun menos
     documentacion publica disponible para contrastar que CUFE/CUDE.
   - El `documentType` del proveedor se asume siempre `"NIT"` (`GenerateElectronicSupportDocumentUseCase`)
     porque `Supplier` no distingue tipo de documento — un proveedor persona natural
     probablemente deberia llevar cedula (CC), no NIT. Sin verificar/sin campo dedicado todavia.
9. **RIDE (PDF)**: implementado para los 5 tipos (ver punto 13 de "Implementado"), pero:
   - El **contenido del QR** (`NumFac|FecFac|NitFac|ValFac|<codigo unico>`, ver
     `ride-data-mapper.ts`) es un formato best-effort **sin verificar** contra el que exige el
     Anexo Tecnico DIAN — que ademas espera que el QR apunte a una URL de consulta publica
     (`catalogo-vpfe.dian.gov.co` o similar) que no existe sin credenciales de produccion reales.
   - El **layout en si** (que campos van donde, tamaños, orden) es una interpretacion propia de lo
     que suele mostrar un RIDE, no una plantilla oficial de la DIAN.
   - El documento soporte no tiene desglose de lineas en su PDF porque su XML tampoco las tiene
     (ver punto 8 — hueco preexistente del builder, no ampliado por este RIDE).
   - No se descarga/embebe el logo de la empresa (`Company.logoUrl` existe pero no se usa aqui).
10. **Nomina electronica (CUNE) — la parte MAS especulativa de todo el modulo**:
    - El **esquema XML** en `application/dian-payroll-xml-builder.ts` es una estructura best-effort
      propia, **sin contrastar contra el XSD/Anexo Tecnico real** de la Resolucion 000013 de 2021
      (que es mucho menos publico que el de UBL de factura/notas). Tratar como placeholder.
    - El orden de concatenacion del CUNE (`application/cune-generator.ts`) tiene aun **menos**
      documentacion publica disponible para contrastar que CUFE/CUDE/CUDS.
    - `DianNominaSoapClient` asume un servicio DIAN separado del de facturacion, pero ni el
      endpoint ni los nombres de operacion (`SendNominaAsync`/`GetStatusNomina`) estan confirmados
      publicamente — a diferencia de `dian-soap-client.ts`, donde al menos el patron
      `SendBillAsync`/`GetStatusZip` es razonablemente citado. Sin prueba automatizada, mismo
      criterio que el cliente SOAP de facturacion.
    - **Numeracion sin resolucion DIAN**: se asume (entendimiento general, **sin verificar en
      este codigo**) que la nomina electronica no requiere un rango autorizado por la DIAN como
      si lo requiere facturacion, y se usa un contador simple (`Company.payrollElectronicSequence`)
      en su lugar. Si esto es incorrecto, hay que migrar nomina a usar
      `InvoiceNumberingResolution` como los demas tipos de documento.
    - **Retencion en la fuente**: el motor de calculo de nomina (`payroll-calculator.ts`) no
      calcula retencion en la fuente, por lo que el nodo correspondiente en el XML se envia fijo
      en `0.00`. No se implemento un calculo nuevo para no inventar una formula sin verificar.
    - `workerType`/`workerSubtype` en `Employee` tienen valores por defecto (`"01"`/`"00"`) sin
      verificar que sean los codigos DIAN correctos para el caso general.
    - `Company.municipalityCode` (codigo DANE del lugar de trabajo) es opcional y no se captura
      hoy en ningun formulario — el XML lo omite si no esta configurado. Ademas se asume una sola
      sede para todos los empleados, sin per-empleado.
