# Información exógena DIAN (ítem 37 de docs/ALCANCE.md)

Reporte informativo anual que las empresas presentan a la DIAN detallando transacciones con
terceros (proveedores/clientes). Módulo cross-cutting sin tabla propia: agrega datos ya existentes
de `suppliers` (compras, retenciones practicadas, cuentas por pagar), `pos/sale` (ventas,
retenciones sufridas) y `collections` (cuentas por cobrar).

Formatos implementados, generados como archivo plano delimitado por `|` (convención real de los
archivos DIAN, sin encabezado, una fila por línea) en `GET /reports/exogena/<formato>/download`, y
como JSON de previsualización en `GET /reports/exogena/<formato>`:

- **1001** — Pagos o abonos en cuenta, por proveedor.
- **1003** — Retenciones en la fuente practicadas, por proveedor y concepto.
- **1007** — Ingresos recibidos, por cliente.
- **1008** — Saldos de cuentas por cobrar, por cliente.
- **1009** — Saldos de cuentas por pagar, por proveedor.
- **1005** — IVA descontable por proveedor e IVA de devoluciones en ventas por cliente (2026-11-24).
- **1006** — IVA generado e impuesto al consumo por cliente (2026-11-24).
- **2276** — Rentas de trabajo por empleado: salarios, prestaciones, otros pagos, cesantias, aportes y
  retencion (2026-11-24).

## Revision del 2026-11-24 (Resolucion DIAN 000227 de 2025, corregida por la 000237 de 2025)

- **1001 reportaba todo con el concepto 5002, que es Honorarios** (no "compra de bienes y servicios")
  y con el IVA dentro del pago. Ahora el concepto sale de la retencion practicada (5002 honorarios,
  5004 servicios, 5005 arrendamientos) o de la cuenta que debito la compra (1435 -> 5007 compra de
  activos movibles, 15xx -> 5008 activos fijos, gasto -> 5016 los demas costos), una fila por proveedor
  y concepto, con el pago sin IVA (el IVA va en el 1005) y las casillas de retencion de renta e IVA
  separadas. Los salarios no van en el 1001 (par. 12): van en el 2276.
- **Consumidor final**: ventas, facturas sin cliente y cierres de un POS externo van en un solo registro
  222222222, tipo de documento 43, "CUANTIAS MENORES" (1006, 1007) o "CONSUMIDOR FINAL" (devoluciones en
  el 1005). Antes el 1007 las omitia y quedaba por debajo de lo facturado.
- **1007** suma ventas del POS (subtotal antes de descuento, incluidas las devueltas), facturas manuales
  y cierres de POS externo, con concepto 4001, y separa devoluciones, rebajas y descuentos (descuentos de
  linea, devoluciones y notas credito).
- Datos: `PrismaExogenaDataReader` lee el año (compras con su tipo, ventas, facturas manuales, cierres de
  turno, devoluciones con su IVA, notas credito libres, nomina aprobada y liquidaciones de prestaciones);
  los formatos son funciones puras en `application/exogena-formats.ts`, con pruebas.
- Sin verificar: el orden exacto de columnas de cada archivo plano (esta en los anexos tecnicos de la
  resolucion, no en su texto) y la clasificacion de cada concepto de nomina en las columnas del 2276.
- Pendiente: los gastos (modulo Gastos) no entran al 1001 porque el beneficiario es texto libre sin NIT;
  devoluciones en compras (IVA recuperado del 1006) no existen en Contapro.

## Limitaciones e items sin verificar (leer antes de un envío real)

**El layout de columnas de cada formato es best-effort, basado en la estructura públicamente
documentada de estos formatos — NO está validado contra el prevalidador oficial de la DIAN ni
contra la Resolución vigente del año fiscal que se esté reportando** (los códigos de formato/
resolución cambian de año a año). Mismo criterio que `electronic-invoicing/README.md`: implementado
completo pero sin forma de probarlo contra el servicio/software real sin credenciales o el
prevalidador oficial.

1. ~~Concepto de pago del formato 1001 genérico y fijo (5002)~~: corregido el 2026-11-24 (ver arriba).
   Una compra mixta (inventario y servicio en la misma factura) va completa al concepto de su cuenta principal.
2. **Concepto de retención del formato 1003** depende de `WithholdingConcept.dianConceptCode`
   (campo nuevo, opcional) — si un concepto de retención no lo tiene asignado, sus filas quedan
   marcadas `conceptoIncompleto: true` en el JSON de previsualización (el archivo de descarga deja
   la columna en blanco, no bloquea la generación).
3. **Formatos 1008/1009 (saldos) usan el saldo ACTUAL del sistema**, no un snapshot histórico real
   al 31 de diciembre del año fiscal — `AccountReceivable`/`AccountPayable` no versionan el saldo
   en el tiempo. Es preciso si el reporte se genera poco después del cierre del año fiscal; si hay
   pagos posteriores a esa fecha, el saldo ya no coincide con el de esa fecha exacta.
4. **Nombre no se separa en apellidos/nombres**: `Customer.name`/`Supplier.name` es un solo campo
   de texto libre y va completo a la columna de razón social, sea persona natural o jurídica.
5. **País fijo "169" (Colombia)**: no existe campo país en `Customer`/`Supplier` (se asume que el
   negocio solo transa localmente).
6. **Terceros sin `municipalityCode`/`documentType` real** se incluyen igual en el reporte, solo
   marcados `incompleto: true` en el JSON de previsualización — no bloquea la generación por datos
   faltantes en terceros creados antes de este ítem.
7. ~~Sin pantalla de edición general de terceros~~: clientes y proveedores ya se pueden editar
   (`PATCH /customers/:id`, y `PATCH /suppliers/:id` desde el 2026-11-24), así que `documentType` y
   `municipalityCode` de terceros antiguos se corrigen desde la web.
8. ~~Formato 1007 excluye ventas sin cliente identificado~~: desde el 2026-11-24 van en el registro
   222222222 "CUANTIAS MENORES" (art. 1.3.5.4.1 par. 1).
