# API pública + webhooks salientes (ítem 40 de docs/ALCANCE.md)

Capa genérica de integración para terceros (Zapier, Make, o un script propio de sincronización
con una tienda en línea). **No incluye conectores nativos a Shopify/WooCommerce/Mercado Libre**
(requieren credenciales de desarrollador de cada plataforma, no disponibles en este entorno —
mismo tipo de limitación ya documentada para Wompi/DIAN) — esta es la base que ese conector
usaría.

## Autenticación

Cada request a `/api/public/v1/*` lleva `Authorization: Bearer <api key>`. La key se crea desde
`/integrations` (o `POST /api/api-keys`, requiere el permiso `api-key.manage`) y se muestra
**una sola vez** — solo se guarda su hash SHA-256. Cada key tiene una lista de `scopes` (códigos
de permiso del catálogo interno) que deben ser un subconjunto de los permisos de quien la crea.

El middleware de autenticación (`apps/api/src/shared/middlewares/api-key-auth.middleware.ts`)
puebla el mismo contexto de tenant que usa el resto del sistema (`companyId`, `permissions` =
scopes de la key) — por eso los endpoints públicos reusan `requirePermission()` y los casos de
uso/repositorios existentes sin ningún cambio.

Límite de tasa: 120 solicitudes/minuto por API key (`public-api-rate-limit.middleware.ts`,
independiente del límite general de la API interna).

## Endpoints

| Método | Ruta | Scope requerido | Descripción |
|---|---|---|---|
| GET | `/api/public/v1/products` | `product.read` | Lista productos (`?search=`) |
| GET | `/api/public/v1/products/:id` | `product.read` | Detalle de un producto |
| GET | `/api/public/v1/customers` | `customer.read` | Lista clientes (`?search=`) |
| POST | `/api/public/v1/customers` | `customer.manage` | Crea un cliente |
| GET | `/api/public/v1/sales` | `sale.read` | Lista ventas (`?take=&skip=`) |
| POST | `/api/public/v1/sales` | `sale.create` | Crea una venta (mismo shape que `POST /sales` interno) |
| GET | `/api/public/v1/shift-closes` | `accounting.read` | Lista cierres de turno reportados (`?take=&skip=`), con su estado |
| POST | `/api/public/v1/shift-closes` | `accounting.manage` | Contabiliza un cierre de turno completo, ver abajo |
| POST | `/api/public/v1/electronic-invoices` | `sale.create` | Genera una factura electrónica DIAN sin inventario/catálogo/contabilización, ver abajo |
| GET | `/api/public/v1/electronic-invoices/:id` | `sale.read` | Número, CUFE y estado de una factura ya pedida |
| GET | `/api/public/v1/electronic-invoices/:id/pdf` | `sale.read` | El RIDE (PDF) de la factura |
| POST | `/api/public/v1/purchases` | `suppliers.manage` | Registra una compra a proveedor (costo + cuenta por pagar + comprobante), ver abajo |
| POST | `/api/public/v1/accounts-payable/:accountPayableId/payments` | `suppliers.manage` | Abono a la cuenta por pagar creada por `/purchases` |
| POST | `/api/public/v1/expenses` | `expense.manage` | Registra un gasto operativo pagado de caja/banco, ver abajo |

`POST /api/public/v1/sales` es el punto de integración de mayor valor: un pedido de e-commerce se
registra como una venta real, con su factura electrónica DIAN generada automáticamente (mismo
flujo que una venta desde el POS). Requiere `branchId` explícito en el body — una integración
externa no conoce la sucursal interna, así que debe configurarse una vez en la integración misma.

## Cierre de turno (item nuevo 2026-09-29/10-02)

Pensado para un POS externo de alto volumen (restaurante, droguería, ferretería) que se integra
via API key para que Contapro le lleve la contabilidad **sin** usar `POST /sales` (que exige
catálogo de productos propio de Contapro y mueve inventario — no aplica si el POS externo lleva
su propio inventario). El POS no manda una venta a la vez: manda **un resumen por cierre de
turno**, y Contapro lo convierte en **un solo comprobante contable** (no uno por venta — un
restaurante con cientos de ventas diarias llenaría la contabilidad de comprobantes que nadie
revisa).

- **Idempotencia real, no solo un chequeo cosmético**: el header `Idempotency-Key` (el id propio
  del turno en el POS externo) es obligatorio. Un reintento con la misma key:
  - Si el cierre anterior quedó **POSTED**, devuelve ese mismo resultado sin reprocesar (nunca
    duplica el comprobante).
  - Si el cierre anterior quedó **FAILED** (ej. timeout de red, dato inconsistente ya corregido),
    **sí se reintenta** — un fallo no deja el turno atascado para siempre.
- **El POS manda conceptos** (`CASH`/`CARD`/`TRANSFER`/`TRADE_IN`/`PLATFORM`, desglose de ventas
  por tarifa IVA/INC, devoluciones, gastos, retiros, anticipos, arqueo), **nunca códigos de
  cuenta** — `PostShiftCloseJournalEntryUseCase` (módulo `accounting`) los resuelve a las cuentas
  del PUC de cada empresa (se crean solas la primera vez, mismo patrón `resolvePostingAccount` que
  el resto de comprobantes automáticos del sistema).
- **Cubre todo lo que mueve dinero en el turno**, no solo ventas: devoluciones, gastos pagados de
  caja, retiros del propietario, anticipos de apartados/órdenes de servicio (pasivo, **nunca
  ingreso** hasta que se entregue lo comprado), equipos usados recibidos como parte de pago
  (`TRADE_IN`, entra como activo — inventario de usados, no como caja/banco), pedidos de
  plataformas tipo Rappi (`PLATFORM`, queda como cuenta por cobrar a la plataforma, no como caja),
  y el faltante/sobrante del arqueo (`cashExpected` vs `cashCounted`).
- **Varios movimientos del mismo concepto se consolidan en una sola línea** — 200 ventas en
  efectivo generan UNA línea de Caja, no 200 (se acumula en memoria antes de armar el
  comprobante). Una cuenta puede acumular débitos Y créditos a la vez en el mismo turno (ej. Caja
  recibe ventas pero también paga un gasto) — se **netea** antes de emitir, nunca se manda una
  línea con débito y crédito simultáneos (el motor de comprobantes lo rechazaría).
- **Si los totales que manda el POS no cuadran** (ej. la suma de `payments` no coincide con la
  suma de `salesTaxBreakdown`), el comprobante se rechaza con un 422 claro (`CreateJournalEntryUseCase`
  ya valida débito=crédito) — nunca se postea un comprobante descuadrado.
- **Cuentas nuevas creadas para este item marcadas "SIN VERIFICAR"** contra el PUC oficial
  colombiano (ver comentarios en `post-shift-close-journal-entry.use-case.ts`) — son un código
  razonable pero el contador de cada empresa puede reclasificarlas. Las que ya usaban otros
  comprobantes del sistema (Caja 1105, Bancos 1110, Ingresos 4135, IVA 2408, Sobrantes 4295,
  Faltantes 5195) se reusan tal cual.
- **Fuera de alcance a propósito** (confirmado con el usuario 2026-10-02):
  - **Compras a proveedores**: no entran en el cierre de turno — van por `POST
    /api/public/v1/purchases`, un endpoint aparte (ver sección propia abajo). Son un movimiento de
    dinero distinto al de la caja de ventas, así que no hay riesgo de doble contabilización entre
    los dos.
  - **Cuenta de tarjeta configurable**: hoy el método `CARD`/`TRANSFER` siempre va a la cuenta fija
    1110 "Bancos". Dejar que el contador elija otra cuenta (ej. neta de comisión del datáfono)
    queda pendiente.
  - **Fiado por cliente** (nuevas ventas a crédito y cobros de cartera con desglose por cliente):
    requiere integrarse con el módulo `collections` (`AccountReceivable`), que hoy exige un
    `saleId` real — un POS externo sin `Sale` interno no puede crear ahí directo sin antes
    relajar esa dependencia. Pendiente, evaluado pero no construido todavía.
  - **Propinas y recargos de plataforma**: decisión de negocio confirmada (no son ingreso propio
    del negocio — las propinas son del mesero, de un recargo de plataforma solo la comisión que
    efectivamente se queda el negocio es ingreso) pero todavía no hay un concepto dedicado en el
    payload para separarlos explícitamente del resto de las ventas.
- **Doble contabilización — regla de diseño, no solo documentación**: la facturación electrónica
  DIAN de un POS externo **no debe** generar comprobante contable (eso ya sale completo del cierre
  de turno). Ver `POST /api/public/v1/electronic-invoices` (abajo) para la factura en sí.

## Factura electrónica sin inventario (item nuevo 2026-10-02)

`POST /api/public/v1/electronic-invoices`: un POS externo le pide a Contapro **solo** la factura
electrónica DIAN (número, CUFE, estado, PDF) para un pedido ya facturado del lado del POS — sin
mover inventario, sin usar el catálogo de productos de Contapro, y **sin generar ningún
comprobante contable** (eso ya sale completo del cierre de turno, ver arriba — por diseño, para
que una misma venta no se contabilice dos veces).

- **Capa delgada sobre `CreateManualInvoiceUseCase`** (módulo `manual-invoicing`) — esa pieza ya
  hacía exactamente esto (factura sin POS/producto/inventario/contabilización) para el caso de
  una empresa que factura "solo con esto" desde el panel web. No se duplicó lógica de negocio, el
  endpoint público es un wrapper que además resuelve el comprador.
- **Comprador por documento, no por `customerId`**: el POS externo no conoce los ids internos de
  Contapro — manda `buyer: {documentType, documentNumber, name, email?, phone?}` (opcional, sin
  `buyer` factura a consumidor final genérico) y el endpoint busca o crea el cliente por
  `documentNumber` (`Customer.@@unique([companyId, documentNumber])` garantiza que nunca duplica).
- **No recibe `payments`**: confirmado que `GenerateElectronicInvoiceUseCase` no usa la forma de
  pago para nada del lado DIAN, y como la contabilidad ya sale del cierre de turno, pedirle ese
  dato al POS no serviría para nada.
- **El PDF reusa el renderer existente tal cual** (`GET .../pdf` monta directamente
  `electronicInvoicingController.getPdfByManualInvoice`, el mismo handler que ya sirve el RIDE de
  una factura manual por JWT — cero código nuevo de renderizado, solo se expone bajo auth por API
  key).
- **`status: "PENDING"`** si la factura se creó pero la generación DIAN todavía no corrió o falló
  (`CreateManualInvoiceUseCase` nunca bloquea por esto) — cualquier otro valor es el estado real
  de `ElectronicInvoice` (`GENERATED`/`PENDING_SUBMISSION`/`ACCEPTED`/`REJECTED`, según el
  proveedor configurado por la empresa).
- **Verificado en vivo contra el sandbox real de Factus** (2026-10-02): número/CUFE reales,
  estado `ACCEPTED`, PDF generado y leído con contenido correcto. Con un comprador específico
  (`documentType: "CC"`) el sandbox compartido devolvió `REJECTED` ("Error de validación") — con
  consumidor final (`buyer` omitido) se aceptó sin problema. No se investigó más a fondo porque es
  el mismo tipo de limitación de catálogos DIAN sin verificar ya documentada en
  `modules/electronic-invoicing/README.md` (no específico de este endpoint).

## Compras, pagos a proveedores y gastos (item nuevo 2026-10-02)

Tercera pieza de la integración con un POS externo (después de cierre de turno y factura
electrónica): el POS también maneja órdenes de compra, recepción de mercancía al costo, cuentas
por pagar a proveedores y sus abonos, y gastos operativos con categoría. A diferencia del resumen
de ventas (que se consolida en un solo comprobante por turno, ver arriba), cada compra/gasto es un
movimiento de dinero independiente que **sí se contabiliza por su cuenta** — el usuario los excluyó
del cierre de turno justo porque son un movimiento distinto, no porque no deban contabilizarse.

- **`POST /api/public/v1/purchases`**: capa delgada sobre `CreatePurchaseUseCase` (módulo
  `suppliers`), la misma pieza que ya usa el panel interno — crea la cuenta por pagar y contabiliza
  (Inventario/Gasto + IVA descontable contra Proveedores) en el mismo paso. Sin líneas de producto:
  solo recibe los totales de la factura del proveedor (`subtotal`/`taxTotal`/`total`), igual que el
  formulario interno — el POS no usa el catálogo de Contapro aquí tampoco.
  - **Proveedor por NIT, no por id interno**: se manda `supplier: {nit, name, documentType?,
    isObligatedToInvoice?}` y se busca/crea por NIT (`Supplier.@@unique([companyId, nit])`
    garantiza que nunca duplica) — mismo criterio que el comprador de `/electronic-invoices`.
  - **Sin retenciones**: el POS no las calcula, siempre se manda `withholdings: []` (igual que
    cuando el contador no marca ninguna en el formulario interno). Si una empresa necesita que el
    POS también reporte retenciones, es una extensión futura, no construida.
  - Devuelve `accountPayableId`, necesario para el siguiente endpoint.
- **`POST /api/public/v1/accounts-payable/:accountPayableId/payments`**: reusa
  `RegisterSupplierPaymentUseCase` tal cual (mismo caso de uso que el panel interno) — body
  `{amount, method}`. Contabiliza el abono (Proveedores contra Caja/Bancos) en el mismo llamado.
- **`POST /api/public/v1/expenses`**: capa delgada sobre `CreateExpenseUseCase` (módulo
  `expenses`) — un gasto se contabiliza y se paga completo en el mismo momento (sin cuenta por
  pagar, a diferencia de una compra a proveedor).
  - **Categoría por `code`, no por id interno**: el contador configura de antemano las categorías
    de gasto en Contapro (cada una con su cuenta PUC, ej. `ARRIENDO` → 5120) y le pasa esos códigos
    al integrador del POS — mismo criterio que los conceptos de cierre de turno
    (`CASH`/`CARD`/etc.). Un código desconocido o de una categoría inactiva se rechaza con un 422
    claro, nunca se inventa una cuenta.
- **Verificado en vivo contra Postgres local** (2026-10-02): compra creada con proveedor nuevo
  (resuelto por NIT), abono parcial registrado contra la cuenta por pagar correcta (`balance`
  bajó de 119.000 a 69.000), gasto registrado contra una categoría real ya configurada en la
  empresa demo, y el rechazo de un `categoryCode` inexistente confirmado. Los tres comprobantes
  contables (`journalEntryId`) se verificaron no nulos consultando `GET /purchases` y
  `GET /expenses` después de cada llamada.
- **Fuera de alcance a propósito**: órdenes de compra y recepción de mercancía como pasos
  separados (el POS ya los maneja de su lado — Contapro solo necesita el hecho financiero final,
  igual que no necesita el detalle ticket por ticket de las ventas); listar/consultar compras o
  gastos ya registrados vía API pública (el panel interno ya lo permite por JWT si hace falta).

## Webhooks salientes

Suscripción (`/webhook-subscriptions`, requiere `webhook.manage`/`webhook.read`): `url` +
`eventTypes`. **Único evento disponible en v1: `sale.created`**, disparado al final de
`CreateSaleUseCase` (tanto para ventas desde el POS como desde `POST /api/public/v1/sales`).
Agregar otro evento (`product.updated`, `stock.low`, etc.) es una llamada de una línea
(`webhookDispatcherService.dispatch(eventType, payload)`) desde el caso de uso correspondiente —
instrumentar los ~15 casos de uso que mutan producto/inventario queda fuera de este ítem.

Cada suscripción tiene un `secret` (mostrado una sola vez al crearla, igual que la API key) usado
para firmar el body con HMAC-SHA256:

```
signature = HMAC_SHA256(secret, JSON.stringify({ eventType, data, timestamp }))
```

enviado en el header `X-Webhook-Signature`. El receptor debe recalcular la firma con el mismo
secreto y compararla contra el header para confirmar que el webhook viene realmente de Contapro
(mismo principio que Wompi usa para firmar SUS webhooks hacia nosotros, en la dirección inversa).

Payload de `sale.created`:
```json
{
  "eventType": "sale.created",
  "data": { "id": "...", "number": 123, "customerId": "...", "total": 119000, "currency": "COP", "status": "COMPLETED", "createdAt": "..." },
  "timestamp": "2026-08-07T12:00:00.000Z"
}
```

Cada intento de entrega queda registrado en `WebhookDelivery` (éxito/fallo, status HTTP, error),
consultable en `GET /webhook-subscriptions/:id/deliveries` y reenviable manualmente
(`POST /webhook-deliveries/:id/resend`) desde la UI si falló.

## Fuera de alcance (documentado explícitamente)

1. **Sin conectores nativos a Shopify/WooCommerce/Mercado Libre** — requieren credenciales de
   desarrollador (OAuth app) de cada plataforma, no disponibles en este entorno.
2. **Sin más eventos de webhook** más allá de `sale.created` — el despachador es genérico,
   agregar otro evento es trivial pero no se instrumentó en los demás casos de uso.
3. **Sin reintentos automáticos con backoff** — cada entrega fallida queda registrada con un
   botón "reenviar" manual en la UI; una cola de reintentos con backoff exponencial es un ítem de
   ingeniería mayor.
4. **Sin documentación OpenAPI/Swagger interactiva** — esta tabla es la referencia; no existe
   infraestructura de OpenAPI en el resto de la API interna tampoco.
5. **Gestión restringida a `ADMINISTRADOR`/`PROPIETARIO`** — ni `SUPERVISOR` ni `CONTADOR` pueden
   crear/revocar API keys o webhooks (acceso programático a los datos de la empresa, mismo
   criterio que `rbac.manage`).
