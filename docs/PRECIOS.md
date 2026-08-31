# Precios de Contapro vs. la competencia

Snapshot de mercado tomado el **2026-08-27** (actualizado desde el original del 2026-08-03) para
definir los planes de suscripción del panel SaaS (`packages/database/prisma/seed-base.ts`, tabla
`Plan`). Los precios de la competencia cambian con el tiempo — esto es una fotografía puntual, no
una verdad permanente. Revisar y actualizar periódicamente (al menos antes de cualquier campaña de
publicidad real).

## Lo que cobra Alegra por su plan de **contabilidad completa** (COP/mes) — referencia directa

Alegra separa el precio de solo-facturación del de contabilidad completa (que sí incluye POS/
inventario). Como Contapro compite con el plan completo, este es el comparativo relevante:

| Plan Alegra | Precio/mes | Incluye |
|---|---|---|
| Emprendedor | $69.900 | ingresos hasta $10.000.000/mes |
| Pyme | $149.900 | ingresos hasta $40.000.000/mes, 1 usuario gratis para contador |
| Pro | $219.900 | ingresos hasta $180.000.000/mes |
| Plus | $279.900 | ingresos hasta $500.000.000/mes, 8 usuarios |

**Importante**: esos precios de Alegra son SOLO por contabilidad — POS ($25.900–$199.900/mes) y
nómina ($29.900–$259.000/mes) se cobran **aparte**, como productos separados. Ver "hallazgo clave"
abajo.

## Otros competidores (COP/mes, plan "pyme típica")

| Proveedor | Solo factura (1 usuario) | Completo (factura+contab+inventario) | Nómina (add-on) | POS |
|---|---|---|---|---|
| Siigo | $9.992–$18.393 | ~$145.993–$207.869 | cotización aparte | ~$25.000+ |
| World Office | — (solo anual) | $170.000 | incluida solo en plan tope ($182.750) | $56.667 |
| Loggro | — | $133.990 (Estándar) | $72.990 | $54.990–$96.990 |
| Helisa | sin precio público | cotización | cotización | — |

Fuentes: siigo.com/facturacion-electronica, comparasoftware.co/siigo-facturacion,
alegra.com/colombia/precios, alegra.com/colombia/facturacion-electronica/precios,
alegra.com/colombia/nomina-electronica/planes, alegra.com/colombia/pos/precios,
worldoffice.com.co/planesCloud.html, loggro.com/pymes/planes,
blog.alegra.com/colombia/alegra-vs-siigo-colombia.

## El hallazgo clave: fragmentación de precios

Siigo, Alegra y World Office venden **facturación, contabilidad, POS y nómina como productos/
módulos separados** — el costo real de una implementación completa sube 30-80% sobre el precio de
entrada anunciado. Esa fragmentación es la queja más repetida en comparadores de terceros.

Contapro ya tiene nómina electrónica DIAN, POS con costeo FIFO/kardex, conciliación bancaria y
devoluciones implementados de fábrica. El mensaje comercial no es solo "más barato" — es **"el
mismo precio de entrada de Alegra, con todo incluido"**: los 3 planes pagos de Contapro quedaron
**igualados exactamente al precio de cada tier de Alegra** (Emprendedor/Pyme/Plus), pero en
Contapro ese precio ya incluye POS y nómina, que en Alegra se cobran aparte. Por eso los 4 planes
de Contapro habilitan el mismo set de funcionalidad (`pos`/`inventory`/`cash`/`payroll`/
`accounting` = `true` en los 4); lo único que escala con el precio es `maxBranches`/`maxUsers`, no
qué módulos están prendidos.

## Planes de Contapro (definidos en `seed-base.ts`, actualizado 2026-08-27)

| Plan | Código | Mensual | Anual (10% desc.) | Sucursales | Usuarios | Referencia de precio |
|---|---|---|---|---|---|---|
| Prueba gratuita | `TRIAL` | $0 | $0 | 1 | 3 | 14 días, todo habilitado (ver `register-company.use-case.ts`) |
| Plan Emprendedor | `BASICO` | $69.900 | $754.900 | 1 | 3 | = Alegra Emprendedor ($69.900, solo contabilidad) |
| Plan Pyme | `PYME` | $149.900 | $1.618.900 | 3 | 10 | = Alegra Pyme ($149.900, solo contabilidad) |
| Plan Plus | `PRO` | $279.900 | $3.022.900 | 10 | 50 | = Alegra Plus ($279.900, solo contabilidad) |

Los códigos internos (`BASICO`, `PRO`) se mantuvieron iguales a los del scaffold original aunque
el nombre visible cambió (`Plan Emprendedor`, `Plan Plus`) — evita dejar filas de `Plan`
huérfanas en bases de datos que ya tenían suscripciones apuntando a esos ids. `PYME` es un plan
nuevo (no existía en el scaffold). Precios subidos el 2026-08-27 desde $39.900/$79.900/$149.900 a
los actuales — ver historial de git para el razonamiento completo.

## Cobro real: SÍ está integrado (Wompi/Bancolombia)

A diferencia de lo que decía una versión anterior de este documento, el cobro real **ya está
funcionando en producción** (confirmado con llaves `pub_prod_`/`prv_prod_` reales, no sandbox):
`POST /admin/subscriptions/:id/checkout` y su equivalente de autoservicio
(`POST /subscription/checkout`, módulo `billing`) generan un link de pago Wompi real, con webhook
que confirma el pago y renueva la suscripción automáticamente. Ver
`apps/api/src/modules/saas-admin/README.md` para el detalle completo, incluido el cobro automático
recurrente (tarjeta guardada) que quedó parcialmente pendiente de verificar (funciona el guardado
de tarjeta, el cobro automático en sí tiene un problema sin resolver con Wompi, ver ese README).
