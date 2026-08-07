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

`POST /api/public/v1/sales` es el punto de integración de mayor valor: un pedido de e-commerce se
registra como una venta real, con su factura electrónica DIAN generada automáticamente (mismo
flujo que una venta desde el POS). Requiere `branchId` explícito en el body — una integración
externa no conoce la sucursal interna, así que debe configurarse una vez en la integración misma.

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
