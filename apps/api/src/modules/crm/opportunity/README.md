# Modulo: CRM basico (pipeline de negociacion)

Estado: **modelo de oportunidad con etapas, que se convierte en una venta real al ganarse,
implementado.** Item 32 de `docs/ALCANCE.md` ("Brecha funcional vs. Alegra/Siigo").

## El hallazgo que fijo el diseño

`Quote.status` (modulo `pos/quote`) ya tenia un comentario sugiriendo valores
`DRAFT/SENT/ACCEPTED/EXPIRED/CONVERTED`, pero estaba **completamente inerte**: solo existen
`CreateQuoteUseCase`/`ListQuotesUseCase`, ningun caso de uso escribe nunca un valor distinto de
`DRAFT`, y `Sale` no tiene ninguna relacion con `Quote` (ni `quoteId` en ningun sentido). Es la
misma categoria de scaffolding muerto que `Customer.currentBalance`/`CustomerCreditMovement`/
`CustomerPayment` (item 31). Por eso se construyo un modelo `Opportunity` nuevo en vez de resucitar
`Quote`/`CONVERTED` -- `Quote` no tiene concepto de etapa, dueño, ni fecha esperada de cierre, y es
un documento de una sola vez (crear+listar).

## Diseño: "cerrar como ganada" reusa CreateSaleUseCase, no lo duplica

`CloseOpportunityAsWonUseCase` llama directo a `createSaleUseCase` (la misma instancia que expone
`sale.container.ts`, mismo patron de reuso cross-modulo que `accounting.container.ts`/
`collections.container.ts` ya usan) con un pago `CREDIT` por defecto sobre `expectedValue`. Esto
hereda gratis, sin codigo nuevo:
- `PostSaleJournalEntryUseCase` -- contabilizacion correcta del asiento.
- `resolveReceivableInput` (item 31) -- crea automaticamente una `AccountReceivable`.
- `GenerateElectronicInvoiceUseCase` -- intento de facturacion electronica.

## Modelos (`packages/database/prisma/schema/crm.prisma`)

- `Opportunity` -- `customerId`, `branchId`, `ownerUserId`, `title`, `stage` (string plano, no
  enum de Prisma, mismo criterio que `Quote.status`: `PROSPECTO/CONTACTO/PROPUESTA/NEGOCIACION`
  abiertas + `GANADA/PERDIDA` terminales), `expectedValue`, `expectedCloseDate?`, `lostReason?`,
  `wonAt?`, `lostAt?`, `saleId?` (unico, seteado solo por `CloseOpportunityAsWonUseCase`).
- `OpportunityItem` -- `productId`, `quantity`, `unitPrice` (precio **negociado**, no el del
  catalogo -- a diferencia de `Quote`, que siempre re-cotiza al `currentPrice` del producto),
  `discountPercent`, `total` (incluye IVA, ver "Bug real encontrado" abajo).
- Sin tabla de historial de etapas: `AuditLog` ya registra quien/cuando/que
  (`OPPORTUNITY_STAGE_CHANGED` con `metadata: {fromStage, toStage}`). Sin campo `probability`:
  nada lo leeria (mismo criterio del item 31 de no agregar columnas muertas).
- `Opportunity` se agrego a `TENANT_MODELS` (tiene `companyId` propio); `OpportunityItem` NO
  (fila hija protegida via su padre, mismo criterio que `QuoteItem`/`SaleItem`).

## Bug real encontrado y corregido en la verificacion en vivo

El primer intento calculaba `expectedValue`/`OpportunityItem.total` como
`unitPrice * quantity * (1 - discountPercent/100)`, **sin impuesto** -- exactamente como
`PrismaQuoteRepository` (que tampoco calcula IVA, porque un `Quote` nunca se convierte en venta).
Al cerrar la primera oportunidad de prueba, `CreateSaleUseCase` rechazo el pago con
`"Los pagos (9600) no cubren el neto a cobrar de la venta (12495)"`: el pago `CREDIT` se arma con
`expectedValue` (sin IVA), pero `CreateSaleUseCase` exige cubrir `netTotal`, que **si** incluye
IVA. Con productos gravados, esto habria fallado el 100% de las veces, no solo en el caso borde de
precio desactualizado (que es la limitacion realmente aceptada, ver abajo). Se corrigio
`PrismaOpportunityRepository.create()` para buscar el `taxRate` vigente del producto (igual que
`PrismaQuoteRepository` busca `currentPrice`, pero para el impuesto en vez del precio, que aqui es
el negociado por el usuario) y calcular el total igual que `create-sale.use-case.ts`
(`applyDiscount` + `calculateTax` de `@erp/shared-utils`). Verificado en vivo: una oportunidad con
`unitPrice` igual al precio actual del producto ahora cierra exitosamente y `expectedValue` coincide
exacto con `sale.total`.

## Limitaciones documentadas (decision consciente, no se toco `CreateSaleUseCase`)

1. **Divergencia de precio si el catalogo cambio entre la creacion y el cierre**:
   `CreateSaleUseCase` siempre re-cotiza los items al precio **vigente** del producto al momento de
   cerrar, no al `OpportunityItem.unitPrice` negociado semanas atras. Si el precio del producto
   cambio, el total facturado puede no coincidir con `expectedValue` (puede fallar por insuficiente
   si subio, o sobrefacturar la diferencia si bajo). Arreglarlo bien exigiria que
   `CreateSaleUseCase` aceptara un override de precio por linea -- se decidio no tocar codigo
   compartido y ya probado por esto.
2. **`Sale.sellerUserId` es quien cierra, no `Opportunity.ownerUserId`**: `CreateSaleUseCase` toma
   `sellerUserId` del `ctx.userId` de la request, sin parametro de override. Si un supervisor
   cierra un trato que un cajero originó, la venta queda atribuida al supervisor.

## Implementado

1. **Pipeline con 4 etapas abiertas + 2 terminales** (`UpdateStageUseCase`): mueve libremente entre
   `PROSPECTO/CONTACTO/PROPUESTA/NEGOCIACION` (adelante o atras), o marca `PERDIDA` (exige
   `lostReason`). Rechaza cualquier cambio si ya esta en `GANADA`/`PERDIDA`. Rechaza
   explicitamente `stage: "GANADA"` por esta via -- ganar solo pasa por
   `POST /opportunities/:id/win`.
2. **Cierre como ganada** (`CloseOpportunityAsWonUseCase`, `POST /opportunities/:id/win`): ver
   diseño arriba. Si el descuento negociado excede el limite del cajero que cierra,
   `CreateSaleUseCase` deja la venta en `PENDING_AUTHORIZATION` (sin contabilizar, sin
   `AccountReceivable` todavia) -- la oportunidad igual pasa a `GANADA` con `saleId` enlazado; un
   supervisor debe autorizar el descuento despues (`POST /sales/:id/authorize-discount`, flujo ya
   existente) para que la venta complete y la cuenta por cobrar aparezca. Verificado en vivo con
   ambos caminos.
3. **Permisos nuevos** `opportunity.manage`/`opportunity.read` (modulo `crm`) -- otorgados a
   `SUPERVISOR` y `CAJERO` (mismo criterio que `customer.manage`/`quote.create`, que ya tienen
   ambos roles: es una feature pre-venta orientada al vendedor/cajero, a diferencia de
   `collection.*`/`expense.*` que van a `CONTADOR`+`SUPERVISOR` sin `CAJERO`).
4. UI web (`/crm`, permiso `opportunity.read` en el nav): tablero por columnas de etapa abierta +
   seccion de ganadas/perdidas, formulario de creacion con lineas de producto (precio negociado
   editable), botones de accion por tarjeta ("Mover a...", "Marcar perdida", "Cerrar ganada").

Verificado en vivo end-to-end contra Postgres local: creacion con calculo de `expectedValue`
correcto (incluido IVA), movimientos de etapa validos e invalidos (`PERDIDA` sin motivo, `GANADA`
directo), cierre exitoso (Sale + AccountReceivable + asiento contable `1305 Clientes` con montos
exactos), caso borde de autorizacion de descuento (venta `PENDING_AUTHORIZATION` sin cuenta por
cobrar, luego autorizada y la cuenta aparece), aislamiento multi-tenant (lista vacia y 404 cruzado
entre dos empresas), permisos (`CAJERO` funciona, `CONTADOR`/`EMPLEADO` no tienen el permiso por
defecto), auditoria (`OPPORTUNITY_CREATED`/`STAGE_CHANGED`/`WON` con metadata correcta).

## Que falta implementar

1. `CreateSaleUseCase` no acepta override de precio por linea -- ver limitacion 1 arriba.
2. Sin reporte de forecast/valor ponderado del pipeline (requeriria un campo `probability` que
   hoy no existe a proposito, ver "Modelos" arriba) -- fuera de alcance de este item.
3. Sin vinculo con `Quote`: una oportunidad no puede "adjuntar" una cotizacion ya emitida como
   artefacto intermedio antes de cerrar -- se evaluo y se descarto por la razon de la seccion
   "El hallazgo que fijo el diseño".
