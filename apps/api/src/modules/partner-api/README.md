# API de aliados (combo Cajapro + Contapro)

Entrada privada para que un aliado que vende Contapro dentro de su paquete cree y renueve las empresas
de sus clientes sin intervención manual. Hoy el único aliado es **Cajapro** (plan "Anual con Contapro",
$1.290.000/año, ver `docs/paso-24-combo-contapro.md` en el repo de Cajapro).

## Cada programa con lo suyo

Cajapro vende y emite la factura electrónica (Factus directo, con los datos del NIT de cada cliente).
Contapro lleva la **contabilidad**: recibe por la API pública un comprobante por cierre de turno, compra y
pago a proveedor. Las facturas de Factus no llegan a Contapro como comprobante (las ventas ya entran con el
cierre de turno), así nada se cuenta dos veces. Por eso el tope de 150 documentos DIAN del plan combo casi
no se usa: la bolsa de facturas la controla el plan de Cajapro.

## Autenticación

`Authorization: Bearer <CAJAPRO_PARTNER_KEY>` — llave secreta compartida entre los dos servidores
(variable de entorno, mínimo 32 caracteres). Vacía = la entrada responde 503 con mensaje claro. Se compara
en tiempo constante (`require-partner-key.middleware.ts`). No usa tenant ni JWT: la llamada no viene de
ningún usuario de empresa (mismo caso que el registro público y el panel SaaS).

## `POST /api/partner/v1/cajapro/accounts`

Idempotente por `externalId` (el id del negocio en Cajapro, tabla `partner_accounts`). Cajapro la llama al
aprobarse cada pago del combo:

```json
{
  "externalId": "uuid del negocio en Cajapro",
  "company": { "name": "...", "legalName": "...", "nit": "901777666", "dv": "5", "documentType": "NIT",
               "email": "...", "phone": "...", "address": "...", "city": "Pereira" },
  "owner": { "fullName": "...", "email": "..." },
  "paidUntil": "2027-10-23T00:00:00Z",
  "issueApiKey": false
}
```

- **Primera vez**: crea la empresa igual que el registro público (sede principal, administrador, caja, PUC,
  retenciones y categorías de gasto) con una **clave temporal** para el dueño, la suscripción al plan
  `COMBO_CAJAPRO` y una **API key** con los scopes que usa Cajapro (`sale.read`, `sale.create`,
  `accounting.read`, `accounting.manage`, `suppliers.manage`, `expense.manage`). Responde 201.
- **Si el NIT ya existe** en Contapro (el cliente se registró por su cuenta): se adopta esa empresa solo si
  `owner.email` es un usuario activo de ella; si no, 409 (nadie se queda con la API key de una empresa
  ajena conociendo su NIT).
- **Renovación** (mismo `externalId`): solo corre `currentPeriodEnd` a `paidUntil`. Sin clave ni API key
  nuevas, salvo `issueApiKey: true` (revoca la anterior). Responde 200.

Respuesta: `{ companyId, created, adminEmail, temporaryPassword | null, apiKey | null, branches[], paidUntil }`.
La clave temporal y la API key solo viajan una vez.

## El cobro es del aliado

- `Subscription.billedBy = "CAJAPRO"`: `RunSubscriptionLifecycleUseCase` no manda recordatorios de pago
  (confundirían al cliente), pero si Cajapro deja de renovar la suscripción vence, pasa a gracia y a
  suspendida como cualquier otra. `autoRenew` se apaga al adoptar una empresa que pagaba con tarjeta.
- El plan `COMBO_CAJAPRO` (precio 0, 1 sede, 3 usuarios, 150 documentos DIAN/mes = Plan Emprendedor) lo
  crea la propia llamada si no existe (el seed no corre en producción). No aparece en la lista de planes
  de "Mi suscripción", y `CreateOwnSubscriptionCheckoutUseCase` no genera link de pago mientras el plan
  sea el combo (salvo SUSPENDED: ahí puede elegir un plan propio de Contapro).

## Verificación

Spec `provision-partner-account.use-case.spec.ts` (alta, renovación, rotación de key, adopción, rechazo) y
prueba en vivo (2026-10-23) con los dos programas corriendo en local: pago del combo en Cajapro sin NIT →
queda esperando; el cliente llena sus datos → empresa creada en Contapro, conexión probada desde Cajapro,
login del dueño con la clave temporal, cierre de turno contabilizado con la API key; renovación → solo
corrió la fecha (misma key). **No probado contra los servidores de Render** (falta poner la llave allá).
