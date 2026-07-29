# Alcance de la Iteración 1

El [`prompt.md`](../../Documents/prompt.md) original describe un ERP completo comparable a
Alegra/Siigo/World Office/Siesa. Ese alcance completo es un proyecto de varios meses de desarrollo.
Esta primera iteración entrega **el scaffold completo del monorepo** (arquitectura, base de datos,
convenciones) y **funcionalidad real end-to-end** en los módulos core, dejando el resto del dominio
completamente modelado en Prisma para que las siguientes iteraciones lo implementen sin rediseñar
la base de datos.

## ✅ Funcional (DB + API + UI web)

| Módulo | Qué incluye |
|---|---|
| **Auth** | Registro de empresa, login, refresh token, logout, JWT (access+refresh) |
| **RBAC** | Roles de sistema (Administrador, Propietario, Contador, Supervisor, Cajero, Empleado), permisos por rol, permisos individuales (override), matriz de permisos |
| **Inventario** | Categorías, marcas, productos, códigos de barras, presentaciones, stock por sucursal (mín/máx), movimientos de stock (entradas/salidas/ajustes) |
| **POS / Facturación** | Venta rápida con carrito, cotizaciones, notas crédito/débito, **autorización de descuento por PIN/contraseña** cuando un cajero supera su límite configurado |
| **Caja** | Apertura/cierre de caja asociada a un empleado, arqueo (conteo de denominaciones), diferencias, movimientos (ingresos/egresos/retiros/consignaciones) |
| **Auditoría** | Registro inmutable (solo `INSERT`) de cambios de precio/costo/código de barras, creación/eliminación de productos, ventas anuladas, devoluciones, apertura/cierre de caja, cambios de permisos/usuarios, login/logout, intentos fallidos, autorización de descuentos |
| **Dashboard** | Ventas del día, productos más vendidos, productos con stock bajo, caja activa |
| **Seguridad de productos** | Cajeros NO pueden modificar precio/costo/código de barras ni eliminar productos (permisos dedicados) |
| **Empleados** | CRUD completo (crear, listar, editar, dar de baja), validación de cédula colombiana |
| **Control de horarios** | Marcación de entrada/salida (`TimeEntry`), consulta por empleado/rango de fechas — alimenta el motor de nómina. Vacaciones y permisos con flujo de aprobación `REQUESTED` → `APPROVED`/`REJECTED`, incapacidades (`SUBMITTED` → `APPROVED`/`REJECTED`), y registro de ausencias justificadas/injustificadas (sin flujo de aprobación, las registra un supervisor) |
| **Nómina Colombia (iteración 2)** | Parámetros legales por año (`PayrollParameter`, tabla global), ciclo de vida de período (`DRAFT` → `CALCULATED` → `APPROVED` → `PAID`), motor de liquidación real: salario prorrateado, auxilio de transporte, horas extra/recargos desde `TimeEntry` (recargo dominical/festivo con **calendario de festivos colombianos calculado algorítmicamente**, `packages/shared-utils/src/colombian-holidays.ts`), deducciones de ley, aportes patronales y provisiones. Desprendible como JSON (`PayslipDocument.summaryJson`). Ver `apps/api/src/modules/payroll/README.md` para las limitaciones conocidas (PDF, contabilidad) |

## 🧱 Modelado en Prisma, con rutas stub (`501 Not Implemented`) documentadas

Cada uno de estos módulos tiene su `schema.prisma` completo y un `README.md` propio en
`apps/api/src/modules/<modulo>/README.md` con el detalle de lo que falta implementar:

- **Proveedores / Compras**: órdenes de compra, recepción de mercancía, cuentas por pagar.
- **Contabilidad**: plan de cuentas, comprobantes (libro diario/mayor), balance general, estado de
  resultados, flujo de caja, conciliación bancaria. También pendiente: generar el `JournalEntry`
  de nómina al aprobar un período (hoy nómina no toca contabilidad).
- **Nómina Colombia (resto)**: generación de PDF del desprendible, reportes mensual/anual
  consolidados, deducciones detalladas (libranzas/embargos).
- **Panel administrador SaaS**: planes, suscripciones, historial de pagos, período de gracia de 2 días,
  recordatorios (8/5/3/1 días antes + día de vencimiento), renovación calculada desde la fecha de
  vencimiento original.
- **Sincronización offline**: patrón *outbox* (`SyncOutbox`, `SyncDevice`, `SyncConflictLog`) para que
  la app móvil funcione sin internet y sincronice al reconectar — el scaffold de SQLite existe en
  `apps/mobile`, pero el motor de sincronización aún no está implementado.
- **Lotes/vencimientos y costeo FIFO**: los modelos (`Batch`, `Kardex`, `Product.costMethod`) están
  listos; el cálculo FIFO real queda pendiente (hoy se soporta costo promedio).

## 📱 Móvil (Expo)

Solo scaffold: navegación, pantallas de login/POS/dashboard consumiendo la misma API REST, y
`expo-sqlite` inicializado con un esquema mínimo de caché. Sin lógica de sincronización todavía.

## Próximos pasos sugeridos (por orden de valor de negocio)

1. ~~Nómina Colombia (motor de cálculo)~~ — implementado en la iteración 2, ver arriba. Queda:
   PDF del desprendible.
2. Contabilidad (comprobantes automáticos desde ventas/compras/nómina + libros).
3. Proveedores/compras (cierra el ciclo de costos e inventario).
4. Panel administrador SaaS (cobro de suscripciones real).
5. Sincronización offline completa en móvil.
6. ~~Vacaciones/permisos/ausencias/incapacidades~~ — implementado.
7. ~~Calendario de festivos colombianos~~ — implementado.
