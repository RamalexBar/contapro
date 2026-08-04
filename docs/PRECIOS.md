# Precios de Contapro vs. la competencia

Snapshot de mercado tomado el **2026-08-03** para definir los planes de suscripción del panel
SaaS (`packages/database/prisma/seed.ts`, tabla `Plan`). Los precios de la competencia cambian
con el tiempo — esto es una fotografía puntual, no una verdad permanente. Revisar y actualizar
periódicamente (al menos antes de cualquier campaña de publicidad real).

## Lo que cobra la competencia (COP/mes, plan "pyme típica")

| Proveedor | Solo factura (1 usuario) | Completo (factura+contab+inventario) | Nómina (add-on) | POS |
|---|---|---|---|---|
| Siigo | $9.992–$18.393 | ~$145.993–$191.327 | cotización aparte | ~$25.000+ |
| Alegra | $17.900 | $163.900 (Pyme) | $29.900 (1-10 empl.) | $25.900–$79.900 |
| World Office | — (solo anual) | $170.000 | incluida solo en plan tope ($182.750) | $56.667 |
| Loggro | — | $133.990 (Estándar) | $72.990 | $54.990–$96.990 |
| Helisa | sin precio público | cotización | cotización | — |

Fuentes: siigo.com/facturacion-electronica, comparasoftware.co/siigo-facturacion,
alegra.com/colombia/precios, alegra.com/colombia/facturacion-electronica/precios,
alegra.com/colombia/nomina-electronica/planes, worldoffice.com.co/planesCloud.html,
loggro.com/pymes/planes, blog.alegra.com/colombia/alegra-vs-siigo-colombia.

## El hallazgo clave: fragmentación de precios

Siigo, Alegra (en su línea básica) y World Office venden **facturación, contabilidad, POS y
nómina como productos/módulos separados** — el costo real de una implementación completa sube
30-80% sobre el precio de entrada anunciado. Esa fragmentación es la queja más repetida en
comparadores de terceros.

Contapro ya tiene nómina electrónica DIAN, POS con costeo FIFO/kardex, conciliación bancaria y
devoluciones implementados de fábrica. El mensaje comercial no es solo "más barato" — es **"un
solo precio, todo incluido"**. Por eso los 4 planes de Contapro habilitan el mismo set de
funcionalidad (`pos`/`inventory`/`cash`/`payroll`/`accounting` = `true` en los 4); lo único que
escala con el precio es `maxBranches`/`maxUsers`, no qué módulos están prendidos.

## Planes de Contapro (definidos en `seed.ts`)

| Plan | Código | Mensual | Anual (10% desc.) | Sucursales | Usuarios | Referencia de precio |
|---|---|---|---|---|---|---|
| Prueba gratuita | `TRIAL` | $0 | $0 | 1 | 3 | 30 días, todo habilitado (ver `register-company.use-case.ts`) |
| Plan Emprendedor | `BASICO` | $39.900 | $430.900 | 1 | 3 | vs. $145.993 Siigo / $163.900 Alegra completo |
| Plan Pyme | `PYME` | $79.900 | $862.900 | 3 | 10 | vs. $250.900 Alegra Pro |
| Plan Plus | `PRO` | $149.900 | $1.618.900 | 10 | 50 | vs. $319.900 Alegra Plus / $182.750 World Office Enterprise |

Los códigos internos (`BASICO`, `PRO`) se mantuvieron iguales a los del scaffold original aunque
el nombre visible cambió (`Plan Emprendedor`, `Plan Plus`) — evita dejar filas de `Plan`
huérfanas en bases de datos que ya tenían suscripciones apuntando a esos ids. `PYME` es un plan
nuevo (no existía en el scaffold).

## Lo que falta para que esto sea un pricing real (no solo un número en el seed)

Estos precios viven hoy únicamente en la tabla `Plan` del panel SaaS — no hay integración de
cobro real (ver [ALCANCE.md](./ALCANCE.md), Panel administrador SaaS: "cobro real de
suscripciones" está implementado a nivel de registro/estado, pero cobrar una tarjeta de verdad
requiere una pasarela — Wompi/PayU/ePayco — que no está integrada). Cambiar estos números no
implica que ya se le pueda cobrar a un cliente real.
