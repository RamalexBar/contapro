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
| **Nómina Colombia (iteración 2, 14 y 19)** | Parámetros legales por año (`PayrollParameter`, tabla global), ciclo de vida de período (`DRAFT` → `CALCULATED` → `APPROVED` → `PAID`), motor de liquidación real: salario prorrateado, auxilio de transporte, horas extra/recargos desde `TimeEntry` (recargo dominical/festivo con **calendario de festivos colombianos calculado algorítmicamente**, `packages/shared-utils/src/colombian-holidays.ts`), deducciones de ley, aportes patronales y provisiones. Desprendible como JSON (`PayslipDocument.summaryJson`) y como **PDF** (`GET /payslips/:id/pdf`, generado al vuelo con `pdfkit`, agregado en la iteración 14 — no confundir con el RIDE de nómina electrónica DIAN, que es el comprobante fiscal, ver Facturación electrónica). Al aprobar un período genera y postea automáticamente su comprobante contable (ver Contabilidad). **Deducciones recurrentes** (`PayrollDeduction`, iteración 19): libranzas y embargos con cuota fija por período (`amountPerPeriod`), saldo opcional que se agota solo (`remainingBalance` → `COMPLETED`) o indefinido hasta cancelar; se aplican en el cálculo y se descuentan del saldo al aprobar (punto sin retorno, igual que la contabilización); no calcula topes legales de embargabilidad, solo evita que `netPay` quede negativo (salvaguarda de datos, no de cumplimiento). Ver `apps/api/src/modules/payroll/README.md` |
| **Contabilidad (iteración 3, 11, 13, 15 y 20)** | Plan de cuentas (CRUD, jerárquico), comprobantes manuales (crear/postear/anular con validación de partida doble), libro mayor, Balance General y Estado de Resultados. Contabilización automática al completar una venta, registrar una compra, aprobar una nómina, registrar un abono a proveedor y cerrar una caja con diferencia (sobrante/faltante) — mismas cuentas estándar creadas solas. **Flujo de caja** (reporte simplificado de entradas/salidas de `CashMovement`+`BankTransaction`, no un Estado de Flujo de Efectivo formal) y **conciliación bancaria** (cuentas bancarias, alta manual de movimientos de extracto, conciliaciones que el usuario confirma contra el libro mayor). El match sigue siendo una confirmación manual del usuario, pero desde la iteración 20 hay un **sugeridor** (`GET /bank-reconciliations/:id/suggested-matches`) que propone pares transacción↔línea de comprobante por monto exacto + fecha dentro de ±5 días (no puede filtrar por cuenta contable porque no hay enlace en el schema entre `BankAccount` y `ChartOfAccounts`). UI web (plan de cuentas, comprobantes, bancos, conciliación) agregada en la iteración 13. **Cierre de período** (`FinancialPeriod`, iteración 15): `POST /financial-periods/:year/:month/close` bloquea comprobantes nuevos (manuales y automáticos) con fecha dentro de ese mes, exigiendo que no queden comprobantes `DRAFT` sin publicar/anular; `reopen` revierte. No genera asiento de cierre formal (traslado a utilidades retenidas) — el Balance General ya calcula la utilidad acumulada dinámicamente, así que esto es un bloqueo de edición, no un cierre contable de libros. UI web con botón "Cerrar periodo"/"Reabrir" agregada en la misma iteración. Ver `apps/api/src/modules/accounting/README.md` |
| **Proveedores / Compras (iteración 3, 10, 13, 16 y 21)** | CRUD de proveedores; orden de compra (crear → enviar → recibir parcial/total); recepción de mercancía con impacto real en inventario (stock por sucursal, lotes si el producto los rastrea, y **recálculo real de costo promedio ponderado** de `Product.currentCost` — primer código que efectivamente lo calcula, antes ningún flujo de entrada de stock lo hacía); registro directo de factura de compra (`Purchase` + `AccountPayable`, contabilización automática); abonos a cuentas por pagar con su propio comprobante contable; cancelación de una compra **con o sin abonos** (iteración 16: si ya tiene abonos, primero los reversa — `SupplierPayment.status` nuevo, `REGISTERED`/`REVERSED` — y anula el comprobante contable de cada uno vía `IJournalEntryRepository.findBySource`, antes de cancelar la compra misma). Orden de compra/recepción y factura **no se enlazan entre sí** (flujos paralelos por diseño). **FIFO real** (iteración 16, en el módulo POS): al completar una venta, si el producto usa `costMethod = FIFO` y `tracksBatches`, se consumen los `Batch` en orden de entrada (más antiguo primero) y el `StockMovement` de salida guarda el costo real ponderado de los lotes consumidos (antes se guardaba el precio de venta como costo, para todos los métodos) — `Product.currentCost` queda en el costo del lote más antiguo que quede disponible. **Kardex** (iteración 21, `modules/inventory/stock`): cada uno de los 6 puntos de escritura de `StockMovement` de todo el sistema ahora genera tambien su fila de `Kardex` (saldo de cantidad/costo/costo promedio resultante) dentro de la misma transacción — `GET /kardex?productId=&branchId=&from=&to=`. UI web (proveedores, órdenes de compra) agregada en la iteración 13. Ver `apps/api/src/modules/suppliers/README.md` para el detalle y lo que sigue pendiente (`StockMovement` por lote, Devoluciones no restaura lotes) |
| **Facturación electrónica DIAN (iteración 4-8, sin UI web todavía)** | Generación local de CUFE/CUDE/CUDS/CUNE (SHA-384) y XML por cada venta completada, cada nota crédito/débito que referencia una venta ya facturada, cada compra a un proveedor marcado como no obligado a facturar electrónicamente (documento soporte), **y cada empleado de cada nómina aprobada (nómina electrónica)**, con numeración DIAN (prefijo/rango/consecutivo atómico por tipo de documento; nómina usa un contador simple propio, sin resolución — ver README) separada del consecutivo interno del POS. Ventas sin cliente usan un identificador genérico de "consumidor final" (constante aislada, pendiente de verificar contra el Anexo Técnico). Firma XAdES-BES (certificado PKCS#12, probada con certificado autofirmado) y envío asíncrono a la DIAN (un poller en proceso por tipo de documento, dos servicios SOAP distintos: uno para factura/notas/documento soporte y otro para nómina) implementados pero **no verificados contra el servicio real de la DIAN** — faltan credenciales de habilitación para probarlos end-to-end. La nómina electrónica es, con diferencia, la parte menos verificada de todo el módulo: esquema XML propio no-UBL sin contrastar contra el Anexo Técnico, servicio SOAP separado sin confirmar ni en nombre, sin retención en la fuente calculada. **RIDE (representación gráfica en PDF)** implementado para los 5 tipos de documento (`GET .../pdf`, `pdfkit`, un solo layout compartido) parseando el XML ya guardado — formato del QR y layout sin verificar contra el Anexo Técnico. Ver `apps/api/src/modules/electronic-invoicing/README.md` para la lista completa de detalles sin verificar |
| **Panel administrador SaaS (iteración 12, 13 y 17)** | Autenticación de plataforma **separada** de la de usuarios de empresa (`PlatformAdmin`, JWT con secreto propio, sin tenant context — ver `apps/api/src/modules/saas-admin/README.md`). CRUD de planes y suscripciones, cobro/renovación (`calculateNextPeriodEnd` desde la fecha de vencimiento **original**, nunca desde la fecha del pago), vista de empresas con su suscripción, dashboard agregado (conteo por estado, próximas a vencer, ingresos del mes). Al registrar una empresa se crea automáticamente una suscripción `TRIALING` de 30 días (valor asumido, el spec no especifica la duración exacta). Poller en proceso (1h) que envía un recordatorio **real por correo** (iteración 17: `IReminderNotifier` / `ResendEmailNotifier`, vía `fetch` directo a la API de Resend, sin SDK) en 8/5/3/1/0 días antes del vencimiento y pasa automáticamente a `GRACE_PERIOD`/`SUSPENDED` según corresponda. `SubscriptionReminderLog` solo se registra si el envío tuvo éxito — un fallo (o `RESEND_API_KEY` sin configurar) deja el recordatorio pendiente para el siguiente ciclo, sin perderlo. **No probado end-to-end contra Resend real** (mismo aviso que la integración DIAN) ni contra WhatsApp (requiere verificación de negocio en Meta, fuera de alcance). UI web (login de plataforma, dashboard, planes, suscripciones, empresas) agregada en la iteración 13 |
| **Sincronización offline (móvil, iteración 18)** | Patrón *outbox* real para ventas: `POST /sync/push` (idempotente por `clientEventId`, reusa `CreateSaleUseCase` — el mismo caso de uso de `POST /sales` — sin lógica de negocio duplicada) y `GET /sync/pull` (catálogo de productos cambiado desde el último pull). Conflictos reales (mismo `clientEventId`, payload distinto) quedan en `SyncConflictLog`. **Bug real encontrado y corregido**: Postgres JSONB no preserva el orden de las claves del payload, así que comparar con `JSON.stringify` plano daba falsos conflictos en reintentos idénticos — se usa una comparación con orden de claves normalizado. Cliente móvil (`apps/mobile`): `POSScreen` ahora lee siempre de `products_cache` local (offline-first, no directo de la API), cola `sales_outbox` con id generado localmente, motor de sync (`pull`/`push`/intervalo cada 30s mientras la app está abierta) y botón manual "Sincronizar". Solo `Sale` está soportado como entidad sincronizable (`CashMovement`/`StockMovement` quedan modelados en el schema pero sin UI ni tabla local todavía). Deliberadamente **sin `@react-native-community/netinfo`** (detección real de reconexión) — no hay forma de verificar en este entorno que un módulo nativo enlace correctamente sin dispositivo/emulador; el intervalo de 30s logra el mismo resultado práctico con un retraso acotado. Verificado en vivo contra el servidor de desarrollo (push nuevo, retry idempotente, conflicto, error de producto inexistente, pull). Ver `apps/api/src/modules/sync/README.md` |

## 🧱 Ya no quedan módulos "stub" (`501 Not Implemented`)

Hasta la iteración 13, cuatro huecos seguían modelados en Prisma sin lógica de negocio real
(contabilidad: cierre de período; nómina: PDF del desprendible; proveedores/POS: consumo FIFO
real; sync: motor de sincronización). Las iteraciones 14-18 cerraron los cuatro, y la iteración 21
cerró un quinto que quedó documentado por separado: `Kardex` (historial de saldos por producto),
que hasta entonces seguía modelado en Prisma sin usarse — ver sus filas en la tabla de arriba y
los README de cada módulo para el detalle.

## 📱 Móvil (Expo)

Navegación, pantallas de login/POS/dashboard consumiendo la misma API REST. POS con
sincronización offline real para ventas (iteración 18, ver fila "Sincronización offline" arriba y
`apps/api/src/modules/sync/README.md`) — el resto de la app (dashboard, futuras pantallas de
caja/inventario) sigue siendo solo scaffold, sin cache local ni cola offline propia todavía.

## Próximos pasos sugeridos (por orden de valor de negocio)

1. ~~Nómina Colombia (motor de cálculo)~~ — implementado en la iteración 2. ~~PDF del
   desprendible~~ — implementado en la iteración 14 (ver punto 15). ~~Deducciones detalladas
   (libranzas/embargos)~~ — implementado en la iteración 19 (ver punto 20).
2. ~~Contabilidad (comprobantes automáticos desde ventas/compras/nómina + libros)~~ — implementado
   en la iteración 3. ~~Flujo de caja, conciliación bancaria~~ — implementado en la iteración 11.
   ~~Cierre de período~~ — implementado en la iteración 15 (ver punto 16). ~~Auto-sugerencia de
   matches en la conciliación bancaria~~ — implementado en la iteración 20 (ver punto 21).
3. ~~Proveedores/compras: orden de compra y recepción de mercancía con impacto real en
   inventario~~ — implementado en la iteración 10 (junto con abonos y cancelación).
   ~~Reversar abonos para poder cancelar una compra con pagos, y consumo FIFO real~~ —
   implementado en la iteración 16 (ver punto 17).
4. ~~Panel administrador SaaS (cobro de suscripciones real)~~ — implementado en la iteración 12.
   ~~UI web del panel~~ — implementada en la iteración 13 (ver punto 14). ~~Envío real de
   recordatorios~~ — implementado en la iteración 17 para correo (ver punto 18); WhatsApp queda
   fuera de alcance (requiere verificación de negocio en Meta).
5. ~~Sincronización offline completa en móvil~~ — implementado para ventas en la iteración 18
   (ver punto 19). Queda: `CashMovement`/`StockMovement` como entidades sincronizables (sin UI ni
   tabla local todavía), NetInfo real, persistencia de sesión en el móvil.
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
    lo que sigue pendiente (ver punto 22 para Kardex; `StockMovement` por lote, Devoluciones no
    restaura lotes).
18. ~~Panel SaaS: envío real de recordatorios~~ — implementado en la iteración 17 para el canal de
    correo (ver punto 4): `IReminderNotifier` (puerto) + `ResendEmailNotifier` (`fetch` directo a
    la API de Resend, sin SDK, mismo criterio que `dian-soap-client.ts`). `SubscriptionReminderLog`
    ahora solo se crea si el envío tuvo éxito (antes se creaba siempre, aunque nada se enviaba
    realmente) — un fallo del proveedor o `RESEND_API_KEY` sin configurar deja el recordatorio
    pendiente para el siguiente ciclo del poller (1h) en vez de perderlo, mismo patrón de
    reintento que `PollDianSubmissionsUseCase`. Verificado en este entorno que el fallo por falta
    de credenciales no tumba el poller y queda auditado (`SUBSCRIPTION_REMINDER_FAILED`); el envío
    real contra una cuenta de Resend de verdad **no está probado** (mismo aviso que la integración
    DIAN). WhatsApp no se implementó — requiere verificación de negocio en Meta y plantillas
    pre-aprobadas, fuera de alcance de este trabajo.
19. ~~Sincronización offline en móvil~~ — implementado en la iteración 18 para ventas (ver punto
    5): `POST /sync/push` (idempotente por `clientEventId`, reusa `CreateSaleUseCase`) y
    `GET /sync/pull` (catálogo de productos). Encontrado y corregido un bug real: Postgres JSONB
    no preserva el orden de las claves del payload, así que comparar con `JSON.stringify` plano
    daba falsos conflictos en reintentos idénticos del mismo evento — se corrigió con una
    comparación de orden de claves normalizado. `POSScreen` (móvil) ahora lee siempre de
    `products_cache` local en vez de la API en vivo (offline-first de verdad, no solo "falla y
    reintenta"). Deliberadamente sin `@react-native-community/netinfo` (no verificable en este
    entorno sin dispositivo/emulador) — un intervalo de 30s cubre el mismo caso de uso. Ver
    `apps/api/src/modules/sync/README.md` para el detalle y lo que sigue pendiente
    (`CashMovement`/`StockMovement` sincronizables, NetInfo real, persistencia de sesión móvil).
20. ~~Nómina: deducciones detalladas (libranzas/embargos)~~ — implementado en la iteración 19 (ver
    punto 1). `PayrollDeduction` (nuevo modelo) registra una cuota fija recurrente por empleado
    (`LOAN_DEDUCTION`/`GARNISHMENT`), aplicada automáticamente en el cálculo de cada período
    mientras esté `ACTIVE` y descontada de su saldo (`remainingBalance`) al **aprobar** el período,
    no al calcular (mismo criterio de "punto sin retorno" que la contabilización y la nómina
    electrónica: calcular es re-ejecutable, aprobar no). Sin `totalAmount`/`remainingBalance` la
    deducción es indefinida hasta cancelarla a mano (`POST /payroll-deductions/:id/cancel`); con
    saldo, pasa sola a `COMPLETED` al llegar a 0. Deliberadamente **no calcula ningún tope legal de
    embargabilidad** (CST) — la cuota ya viene definida externamente (crédito o auto judicial); solo
    existe una salvaguarda de integridad de datos que recorta las deducciones adicionales si
    superarían el `netPay` del período, para que nunca quede negativo. Aparece en el desprendible en
    PDF del empleado. Permiso nuevo `payroll.deduction.manage`. Verificado en vivo end-to-end
    (crear, calcular con cuota completa, aprobar y confirmar decremento de saldo, cuota final
    topada al saldo restante, transición a `COMPLETED`, cancelar, y bloqueo por permisos).
21. ~~Contabilidad: auto-sugerencia de matches en la conciliación bancaria~~ — implementado en la
    iteración 20 (ver punto 2). `GET /bank-reconciliations/:id/suggested-matches`
    (`SuggestBankReconciliationMatchesUseCase`) compara cada `BankTransaction` sin conciliar contra
    las líneas de comprobantes `POSTED` de la empresa dentro de una ventana de ±5 días alrededor
    del período de la conciliación, por **monto exacto**: `confidence: "EXACT"` si además la fecha
    coincide, `"PROBABLE"` si está dentro de la ventana. No puede filtrar por cuenta contable
    porque, como ya documentaba este módulo, no hay ningún enlace en el schema entre `BankAccount`
    y una cuenta específica de `ChartOfAccounts` — es una limitación estructural preexistente, no
    algo que se resolvió aquí. Es de solo lectura (no persiste nada, heurística greedy que nunca
    repite una línea en dos sugerencias) — el usuario sigue confirmando cada sugerencia con el
    endpoint de match ya existente, que no cambió. Verificado en vivo end-to-end (match exacto,
    match probable a 3 días, transacción sin candidato, exclusión tras confirmar un match, y
    bloqueo por permisos).
22. ~~Proveedores: poblar Kardex~~ — implementado en la iteración 21 (ver punto 17,
    `modules/inventory/stock`). Los 6 puntos de escritura de `StockMovement` de todo el sistema
    (entrada manual, ajuste, traslado — dos movimientos —, recepción de mercancía, alta de
    producto con stock inicial, y venta completada) ahora generan también su fila de `Kardex`
    dentro de la misma transacción Prisma (`kardex-writer.ts`, función compartida
    `recordKardexEntry`, mismo criterio que ya usaba `PrismaSaleRepository` para efectos
    secundarios transaccionales). `GET /kardex?productId=&branchId=&from=&to=` (permiso
    `product.read`, reusado). Cada fila guarda el saldo resultante del movimiento
    (`balanceQty`/`averageCost`/`balanceCost`); `averageCost` es una foto de `Product.currentCost`
    en ese momento, no un promedio nuevo por sucursal — para los movimientos que ya lo recalculan
    (recepción con costeo `AVERAGE`, consumo FIFO) el Kardex queda exacto, para los que no lo
    tocan (entrada manual, ajustes, traslados) refleja el costo que el producto ya tenía, igual
    que el resto de la app ya asume ahí — no se inventó una fórmula de promedio por sucursal que
    no existe en ningún otro lado del código. Verificado en vivo end-to-end (entrada manual,
    ajuste, recepción con recálculo de promedio ponderado confirmado, venta, filtro por fecha, y
    permisos); el traslado entre sucursales se verificó por lectura de código, no en vivo, porque
    la empresa demo solo tiene una sucursal.
