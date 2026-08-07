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

## Limitaciones e items sin verificar (leer antes de un envío real)

**El layout de columnas de cada formato es best-effort, basado en la estructura públicamente
documentada de estos formatos — NO está validado contra el prevalidador oficial de la DIAN ni
contra la Resolución vigente del año fiscal que se esté reportando** (los códigos de formato/
resolución cambian de año a año). Mismo criterio que `electronic-invoicing/README.md`: implementado
completo pero sin forma de probarlo contra el servicio/software real sin credenciales o el
prevalidador oficial.

1. **Concepto de pago del formato 1001 es genérico y fijo** (`5002`, "Compra de bienes y/o
   servicios") para todas las filas — el catálogo de productos no clasifica compras por concepto
   DIAN (materias primas, servicios, activos, etc.), así que no hay forma de derivarlo por línea
   de compra. Si se necesita precisión real, hay que reclasificar manualmente antes de un envío.
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
7. **Sin pantalla de edición general de terceros**: `documentType`/`municipalityCode` se piden en
   el alta de proveedor/cliente, pero ni `suppliers` ni `customers` tienen edición general hoy —
   completar estos campos en terceros ya existentes requiere corregirlos directo en base de datos
   hasta que exista esa pantalla.
8. **Formato 1007 excluye ventas sin cliente identificado** ("consumidor final") — no son
   reportables a un tercero específico.
