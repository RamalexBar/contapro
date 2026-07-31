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
| **Nómina Colombia (iteración 2 y 14)** | Parámetros legales por año (`PayrollParameter`, tabla global), ciclo de vida de período (`DRAFT` → `CALCULATED` → `APPROVED` → `PAID`), motor de liquidación real: salario prorrateado, auxilio de transporte, horas extra/recargos desde `TimeEntry` (recargo dominical/festivo con **calendario de festivos colombianos calculado algorítmicamente**, `packages/shared-utils/src/colombian-holidays.ts`), deducciones de ley, aportes patronales y provisiones. Desprendible como JSON (`PayslipDocument.summaryJson`) y como **PDF** (`GET /payslips/:id/pdf`, generado al vuelo con `pdfkit`, agregado en la iteración 14 — no confundir con el RIDE de nómina electrónica DIAN, que es el comprobante fiscal, ver Facturación electrónica). Al aprobar un período genera y postea automáticamente su comprobante contable (ver Contabilidad). Ver `apps/api/src/modules/payroll/README.md` |
| **Contabilidad (iteración 3, 11, 13 y 15)** | Plan de cuentas (CRUD, jerárquico), comprobantes manuales (crear/postear/anular con validación de partida doble), libro mayor, Balance General y Estado de Resultados. Contabilización automática al completar una venta, registrar una compra, aprobar una nómina, registrar un abono a proveedor y cerrar una caja con diferencia (sobrante/faltante) — mismas cuentas estándar creadas solas. **Flujo de caja** (reporte simplificado de entradas/salidas de `CashMovement`+`BankTransaction`, no un Estado de Flujo de Efectivo formal) y **conciliación bancaria manual** (cuentas bancarias, alta manual de movimientos de extracto, conciliaciones que el usuario empareja a mano contra el libro mayor, sin auto-sugerencias). UI web (plan de cuentas, comprobantes, bancos, conciliación) agregada en la iteración 13. **Cierre de período** (`FinancialPeriod`, iteración 15): `POST /financial-periods/:year/:month/close` bloquea comprobantes nuevos (manuales y automáticos) con fecha dentro de ese mes, exigiendo que no queden comprobantes `DRAFT` sin publicar/anular; `reopen` revierte. No genera asiento de cierre formal (traslado a utilidades retenidas) — el Balance General ya calcula la utilidad acumulada dinámicamente, así que esto es un bloqueo de edición, no un cierre contable de libros. UI web con botón "Cerrar periodo"/"Reabrir" agregada en la misma iteración. Ver `apps/api/src/modules/accounting/README.md` |
| **Proveedores / Compras (iteración 3, 10, 13 y 16)** | CRUD de proveedores; orden de compra (crear → enviar → recibir parcial/total); recepción de mercancía con impacto real en inventario (stock por sucursal, lotes si el producto los rastrea, y **recálculo real de costo promedio ponderado** de `Product.currentCost` — primer código que efectivamente lo calcula, antes ningún flujo de entrada de stock lo hacía); registro directo de factura de compra (`Purchase` + `AccountPayable`, contabilización automática); abonos a cuentas por pagar con su propio comprobante contable; cancelación de una compra **con o sin abonos** (iteración 16: si ya tiene abonos, primero los reversa — `SupplierPayment.status` nuevo, `REGISTERED`/`REVERSED` — y anula el comprobante contable de cada uno vía `IJournalEntryRepository.findBySource`, antes de cancelar la compra misma). Orden de compra/recepción y factura **no se enlazan entre sí** (flujos paralelos por diseño). **FIFO real** (iteración 16, en el módulo POS): al completar una venta, si el producto usa `costMethod = FIFO` y `tracksBatches`, se consumen los `Batch` en orden de entrada (más antiguo primero) y el `StockMovement` de salida guarda el costo real ponderado de los lotes consumidos (antes se guardaba el precio de venta como costo, para todos los métodos) — `Product.currentCost` queda en el costo del lote más antiguo que quede disponible. UI web (proveedores, órdenes de compra) agregada en la iteración 13. Ver `apps/api/src/modules/suppliers/README.md` para el detalle y lo pendiente (Kardex, `StockMovement` por lote, Devoluciones no restaura lotes) |
| **Facturación electrónica DIAN (iteración 4-8, sin UI web todavía)** | Generación local de CUFE/CUDE/CUDS/CUNE (SHA-384) y XML por cada venta completada, cada nota crédito/débito que referencia una venta ya facturada, cada compra a un proveedor marcado como no obligado a facturar electrónicamente (documento soporte), **y cada empleado de cada nómina aprobada (nómina electrónica)**, con numeración DIAN (prefijo/rango/consecutivo atómico por tipo de documento; nómina usa un contador simple propio, sin resolución — ver README) separada del consecutivo interno del POS. Ventas sin cliente usan un identificador genérico de "consumidor final" (constante aislada, pendiente de verificar contra el Anexo Técnico). Firma XAdES-BES (certificado PKCS#12, probada con certificado autofirmado) y envío asíncrono a la DIAN (un poller en proceso por tipo de documento, dos servicios SOAP distintos: uno para factura/notas/documento soporte y otro para nómina) implementados pero **no verificados contra el servicio real de la DIAN** — faltan credenciales de habilitación para probarlos end-to-end. La nómina electrónica es, con diferencia, la parte menos verificada de todo el módulo: esquema XML propio no-UBL sin contrastar contra el Anexo Técnico, servicio SOAP separado sin confirmar ni en nombre, sin retención en la fuente calculada. **RIDE (representación gráfica en PDF)** implementado para los 5 tipos de documento (`GET .../pdf`, `pdfkit`, un solo layout compartido) parseando el XML ya guardado — formato del QR y layout sin verificar contra el Anexo Técnico. Ver `apps/api/src/modules/electronic-invoicing/README.md` para la lista completa de detalles sin verificar |
| **Panel administrador SaaS (iteración 12 y 13)** | Autenticación de plataforma **separada** de la de usuarios de empresa (`PlatformAdmin`, JWT con secreto propio, sin tenant context — ver `apps/api/src/modules/saas-admin/README.md`). CRUD de planes y suscripciones, cobro/renovación (`calculateNextPeriodEnd` desde la fecha de vencimiento **original**, nunca desde la fecha del pago), vista de empresas con su suscripción, dashboard agregado (conteo por estado, próximas a vencer, ingresos del mes). Al registrar una empresa se crea automáticamente una suscripción `TRIALING` de 30 días (valor asumido, el spec no especifica la duración exacta). Poller en proceso (1h) que genera recordatorios en 8/5/3/1/0 días antes del vencimiento y pasa automáticamente a `GRACE_PERIOD`/`SUSPENDED` según corresponda — **el envío real del recordatorio (email/WhatsApp) no está implementado**, no hay proveedor integrado, solo queda el registro. UI web (login de plataforma, dashboard, planes, suscripciones, empresas) agregada en la iteración 13 |

## 🧱 Modelado en Prisma, con rutas stub (`501 Not Implemented`) documentadas

Cada uno de estos módulos tiene su `schema.prisma` completo y un `README.md` propio en
`apps/api/src/modules/<modulo>/README.md` con el detalle de lo que falta implementar:

- **Contabilidad (resto)**: cierre de período (`FinancialPeriod`).
- **Nómina Colombia (resto)**: generación de PDF del desprendible, reportes mensual/anual
  consolidados, deducciones detalladas (libranzas/embargos).
- **Sincronización offline**: patrón *outbox* (`SyncOutbox`, `SyncDevice`, `SyncConflictLog`) para que
  la app móvil funcione sin internet y sincronice al reconectar — el scaffold de SQLite existe en
  `apps/mobile`, pero el motor de sincronización aún no está implementado.
- **Costeo FIFO (consumo)**: `Batch` ya se puebla al recibir mercancía (ver Proveedores/Compras
  arriba) y `Product.costMethod` ya se usa para elegir la fórmula de costo al recibir (promedio
  ponderado real o "último costo"), pero el **consumo FIFO real** (agotar lotes en orden de
  entrada al vender) sigue sin implementar — mientras `costMethod = FIFO`, se calcula igual que
  `AVERAGE`. `Kardex` (historial de saldos) sigue sin poblarse, preparado para reportes futuros.

## 📱 Móvil (Expo)

Solo scaffold: navegación, pantallas de login/POS/dashboard consumiendo la misma API REST, y
`expo-sqlite` inicializado con un esquema mínimo de caché. Sin lógica de sincronización todavía.

## Próximos pasos sugeridos (por orden de valor de negocio)

1. ~~Nómina Colombia (motor de cálculo)~~ — implementado en la iteración 2. ~~PDF del
   desprendible~~ — implementado en la iteración 14 (ver punto 15).
2. ~~Contabilidad (comprobantes automáticos desde ventas/compras/nómina + libros)~~ — implementado
   en la iteración 3. ~~Flujo de caja, conciliación bancaria~~ — implementado en la iteración 11.
   ~~Cierre de período~~ — implementado en la iteración 15 (ver punto 16).
3. ~~Proveedores/compras: orden de compra y recepción de mercancía con impacto real en
   inventario~~ — implementado en la iteración 10 (junto con abonos y cancelación).
   ~~Reversar abonos para poder cancelar una compra con pagos, y consumo FIFO real~~ —
   implementado en la iteración 16 (ver punto 17).
4. ~~Panel administrador SaaS (cobro de suscripciones real)~~ — implementado en la iteración 12.
   ~~UI web del panel~~ — implementada en la iteración 13 (ver punto 14). Queda: envío real de
   recordatorios (proveedor de email/WhatsApp).
5. Sincronización offline completa en móvil.
6. ~~Vacaciones/permisos/ausencias/incapacidades~~ — implementado.
7. ~~Calendario de festivos colombianos~~ — implementado.
8. ~~Facturación electrónica: firma XAdES + envío asíncrono a la DIAN~~ — implementado en la
   iteración 5, pero sin verificar contra el servicio real de la DIAN (falta certificado y
   credenciales de habilitación reales para probar end-to-end, ver iteración 4-8 arriba).
9. ~~Facturación electrónica: notas crédito/débito, documento soporte y nómina electrónica~~ —
   implementado en las iteraciones 6-8, mismas limitaciones de verificación contra la DIAN real
   que el punto anterior (nómina es la parte menos verificada de las cuatro).
10. ~~Facturación electrónica: RIDE (PDF)~~ — implementado en la iteración 9 para los 5 tipos de
    documento; formato del QR y layout sin verificar contra el Anexo Técnico (ver iteración 4-8
    arriba). El RIDE es la representación del comprobante DIAN, no el desprendible interno de
    nómina (ver punto 15 para ese otro PDF).
11. ~~Proveedores/compras: abonos a cuentas por pagar y cancelación de compras~~ — implementado
    en la iteración 10 junto con orden de compra/recepción (ver punto 3).
12. ~~Contabilidad: flujo de caja y conciliación bancaria~~ — implementado en la iteración 11
    junto con el ajuste contable al cerrar caja con diferencia (ver punto 2).
13. ~~Panel administrador SaaS~~ — implementado en la iteración 12 (ver punto 4).
14. ~~UI web de Contabilidad, Proveedores/Compras y Panel administrador SaaS~~ — implementada en
    la iteración 13: páginas y llamadas API conectadas al router y al menú de navegación para los
    tres módulos, más el endpoint `GET /api/purchases` que faltaba para listarlas (ver puntos 2,
    3 y 4).
15. ~~Nómina: PDF del desprendible~~ — implementado en la iteración 14: `GET /payslips/:id/pdf`
    genera el PDF al vuelo (`pdfkit`) desde `PayslipDocument.summaryJson` + datos del empleado y
    la empresa, sin depender de que la nómina se haya facturado electrónicamente (ver punto 1).
    Boton "Desprendible PDF" agregado en la UI web de Nómina.
16. ~~Contabilidad: cierre de período~~ — implementado en la iteración 15: `FinancialPeriod` ahora
    se usa de verdad. `CreateJournalEntryUseCase` (punto único de creación de comprobantes,
    manuales y automáticos) rechaza con `409` cualquier comprobante con fecha dentro de un periodo
    `CLOSED`; cerrar exige que no haya comprobantes `DRAFT` sin publicar/anular en ese mes; hay
    `reopen` para corregir. No genera asiento de cierre formal (traslado a utilidades retenidas) —
    el Balance General ya calcula la utilidad acumulada dinámicamente, así que es un bloqueo de
    edición, no un cierre contable de libros (ver punto 2). UI web (botón "Cerrar periodo" /
    "Reabrir" + historial) agregada en la pestaña "Cierre de periodo" de Contabilidad.
17. ~~Proveedores/compras: reversar abonos y consumo FIFO real~~ — implementado en la iteración
    16 (ver punto 3). Reversar abonos: `SupplierPayment` ganó `status`
    (`REGISTERED`/`REVERSED`); `CancelPurchaseUseCase` ahora reversa los abonos activos de la
    cuenta por pagar (restaura `balance`, anula el comprobante de cada abono vía el nuevo
    `IJournalEntryRepository.findBySource`) en vez de responder `409` como antes. FIFO real:
    `PrismaSaleRepository` (módulo POS, único punto donde una venta completada descuenta stock)
    consume `Batch` en orden de entrada cuando `costMethod = FIFO` y `tracksBatches`, calcula el
    costo real ponderado de lo vendido (antes se registraba el precio de venta como costo) y dejó
    `Product.currentCost` en el costo del lote más antiguo restante. Con existencias insuficientes
    en lotes (drift frente a `ProductBranchStock`) el remanente se valora al último costo conocido
    en vez de bloquear la venta. Ver `apps/api/src/modules/suppliers/README.md` para el detalle y
    lo que sigue pendiente (Kardex, `StockMovement` por lote, Devoluciones no restaura lotes).
