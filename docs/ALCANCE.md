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
| **Inventario** | Categorías, marcas, productos, códigos de barras, presentaciones, stock por sucursal (mín/máx), movimientos de stock (entradas/salidas/ajustes). **Listas de precios múltiples** (iteración 35, ver fila más abajo): un producto puede tener overrides de precio por lista (mayorista/minorista/etc.), asignable por cliente |
| **POS / Facturación** | Venta rápida con carrito, cotizaciones, notas crédito/débito, **autorización de descuento por PIN/contraseña** cuando un cajero supera su límite configurado. **Devoluciones** (`Return`, iteración 22, `modules/pos/return`): registra una devolución parcial/total sobre una venta `COMPLETED`/`RETURNED_PARTIAL`, valida contra lo ya devuelto antes (dentro de la misma transacción, evita sobregiro concurrente), restaura stock (lote nuevo si el producto rastrea lotes — no reinserta en el lote FIFO original consumido, ver limitación en `suppliers/README.md`) y contabiliza el reverso de la venta (`PostReturnJournalEntryUseCase`, permite elegir el medio de reembolso independiente del medio de pago original). UI web agregada en `/quotes-notes` |
| **Caja** | Apertura/cierre de caja asociada a un empleado, arqueo (conteo de denominaciones), diferencias, movimientos (ingresos/egresos/retiros/consignaciones) |
| **Auditoría** | Registro inmutable (solo `INSERT`) de cambios de precio/costo/código de barras, creación/eliminación de productos, ventas anuladas, devoluciones, apertura/cierre de caja, cambios de permisos/usuarios, login/logout, intentos fallidos, autorización de descuentos |
| **Dashboard** | Ventas del día, productos más vendidos, productos con stock bajo, caja activa |
| **Seguridad de productos** | Cajeros NO pueden modificar precio/costo/código de barras ni eliminar productos (permisos dedicados) |
| **Empleados** | CRUD completo (crear, listar, editar, dar de baja), validación de cédula colombiana |
| **Control de horarios** | Marcación de entrada/salida (`TimeEntry`), consulta por empleado/rango de fechas — alimenta el motor de nómina. Vacaciones y permisos con flujo de aprobación `REQUESTED` → `APPROVED`/`REJECTED`, incapacidades (`SUBMITTED` → `APPROVED`/`REJECTED`), y registro de ausencias justificadas/injustificadas (sin flujo de aprobación, las registra un supervisor) |
| **Nómina Colombia (iteración 2, 14 y 19)** | Parámetros legales por año (`PayrollParameter`, tabla global), ciclo de vida de período (`DRAFT` → `CALCULATED` → `APPROVED` → `PAID`), motor de liquidación real: salario prorrateado, auxilio de transporte, horas extra/recargos desde `TimeEntry` (recargo dominical/festivo con **calendario de festivos colombianos calculado algorítmicamente**, `packages/shared-utils/src/colombian-holidays.ts`), deducciones de ley, aportes patronales y provisiones. Desprendible como JSON (`PayslipDocument.summaryJson`) y como **PDF** (`GET /payslips/:id/pdf`, generado al vuelo con `pdfkit`, agregado en la iteración 14 — no confundir con el RIDE de nómina electrónica DIAN, que es el comprobante fiscal, ver Facturación electrónica). Al aprobar un período genera y postea automáticamente su comprobante contable (ver Contabilidad). **Deducciones recurrentes** (`PayrollDeduction`, iteración 19): libranzas y embargos con cuota fija por período (`amountPerPeriod`), saldo opcional que se agota solo (`remainingBalance` → `COMPLETED`) o indefinido hasta cancelar; se aplican en el cálculo y se descuentan del saldo al aprobar (punto sin retorno, igual que la contabilización); no calcula topes legales de embargabilidad, solo evita que `netPay` quede negativo (salvaguarda de datos, no de cumplimiento). Ver `apps/api/src/modules/payroll/README.md` |
| **Contabilidad (iteración 3, 11, 13, 15, 20, 29, 34 y 43)** | **PUC precargado y activación por catálogo** (iteración 43, ítem 44): cada empresa arranca con la jerarquía completa del plan de cuentas ya creada (clase→grupo→cuenta→subcuenta); las ~25 cuentas que el motor contable ya usaba de antemano quedan activas desde el registro, el resto queda inactivo hasta que el usuario lo activa con un clic desde "Plan de cuentas" (buscador por código, sin escribir nombres). Plan de cuentas (CRUD, jerárquico), comprobantes manuales (crear/postear/anular con validación de partida doble), libro mayor, Balance General y Estado de Resultados. **Centros de costo** (`CostCenter`, iteración 34): catálogo simple (código/nombre/activo) etiquetable en comprobantes manuales y gastos operativos (`Expense.costCenterId`); Estado de Resultados y Libro Mayor filtran por él (a diferencia de `branchId`, presente en `JournalEntry` desde la iteración 1 pero nunca filtrado por ningún reporte — mismo patrón de columna muerta corregido aquí). No aplica a los demás comprobantes automáticos (venta/compra/nómina/etc.), que ya se segmentan por `branchId`. Contabilización automática al completar una venta, registrar una compra, aprobar una nómina, registrar un abono a proveedor y cerrar una caja con diferencia (sobrante/faltante) — mismas cuentas estándar creadas solas. **Retenciones** (`WithholdingConcept`, iteración 29): catálogo por empresa de conceptos de RteFuente/ReteICA/ReteIVA aplicables en ventas (activo, cuentas 1355xx) y compras (pasivo, cuentas 236xxx); ver fila "Proveedores / Compras" y `modules/accounting/README.md`. **Flujo de caja** (reporte simplificado de entradas/salidas de `CashMovement`+`BankTransaction`, no un Estado de Flujo de Efectivo formal) y **conciliación bancaria** (cuentas bancarias, alta manual de movimientos de extracto, conciliaciones que el usuario confirma contra el libro mayor). El match sigue siendo una confirmación manual del usuario, pero desde la iteración 20 hay un **sugeridor** (`GET /bank-reconciliations/:id/suggested-matches`) que propone pares transacción↔línea de comprobante por monto exacto + fecha dentro de ±5 días (no puede filtrar por cuenta contable porque no hay enlace en el schema entre `BankAccount` y `ChartOfAccounts`). UI web (plan de cuentas, comprobantes, bancos, conciliación) agregada en la iteración 13. **Cierre de período** (`FinancialPeriod`, iteración 15): `POST /financial-periods/:year/:month/close` bloquea comprobantes nuevos (manuales y automáticos) con fecha dentro de ese mes, exigiendo que no queden comprobantes `DRAFT` sin publicar/anular; `reopen` revierte. No genera asiento de cierre formal (traslado a utilidades retenidas) — el Balance General ya calcula la utilidad acumulada dinámicamente, así que esto es un bloqueo de edición, no un cierre contable de libros. UI web con botón "Cerrar periodo"/"Reabrir" agregada en la misma iteración. Ver `apps/api/src/modules/accounting/README.md` |
| **Proveedores / Compras (iteración 3, 10, 13, 16, 21, 23 y 29)** | CRUD de proveedores; retención al proveedor (RteFuente/ReteICA/ReteIVA, iteración 29) que deja el `AccountPayable` neto de retención desde su creación, sin cambios en abonos ni cancelación (ver `modules/suppliers/README.md`); orden de compra (crear → enviar → recibir parcial/total); recepción de mercancía con impacto real en inventario (stock por sucursal, lotes si el producto los rastrea, y **recálculo real de costo promedio ponderado** de `Product.currentCost` — primer código que efectivamente lo calcula, antes ningún flujo de entrada de stock lo hacía); registro directo de factura de compra (`Purchase` + `AccountPayable`, contabilización automática); abonos a cuentas por pagar con su propio comprobante contable; cancelación de una compra **con o sin abonos** (iteración 16: si ya tiene abonos, primero los reversa — `SupplierPayment.status` nuevo, `REGISTERED`/`REVERSED` — y anula el comprobante contable de cada uno vía `IJournalEntryRepository.findBySource`, antes de cancelar la compra misma). Orden de compra/recepción y factura **no se enlazan entre sí** (flujos paralelos por diseño). **FIFO real** (iteración 16, en el módulo POS): al completar una venta, si el producto usa `costMethod = FIFO` y `tracksBatches`, se consumen los `Batch` en orden de entrada (más antiguo primero); `Product.currentCost` queda en el costo del lote más antiguo que quede disponible. **Trazabilidad por lote** (iteración 23): cada lote realmente consumido en una venta genera su propia línea de `StockMovement`/`Kardex` con el costo real de ESE lote (antes una sola línea agregada por item de venta, con el precio de venta como costo para todos los métodos — eso sigue igual para `AVERAGE`/`LAST`, solo `FIFO` guarda el costo real desde la iteración 16). **Kardex** (iteración 21, `modules/inventory/stock`): cada uno de los 6 puntos de escritura de `StockMovement` de todo el sistema ahora genera tambien su fila de `Kardex` (saldo de cantidad/costo/costo promedio resultante) dentro de la misma transacción — `GET /kardex?productId=&branchId=&from=&to=`. UI web (proveedores, órdenes de compra) agregada en la iteración 13. Ver `apps/api/src/modules/suppliers/README.md` para el detalle y lo que sigue pendiente (una devolución sigue creando un lote nuevo en vez de reinsertar en el lote FIFO original exacto) |
| **Gastos operativos (iteración 30)** | Módulo nuevo `expenses` (item 30 de la brecha funcional, distinto de Proveedores/Compras — `Purchase` siempre debita inventario y `AccountPayable` es obligatorio, no servía para arriendo/servicios/reembolsos): catálogo de categorías de gasto por empresa (`ExpenseCategory`, 7 por defecto sembradas igual que `WithholdingConcept`), registro de gastos (`payeeName` libre, no un `Supplier`) **pagados completo de una vez** (sin cuentas por pagar de gastos, decisión de alcance explícita) con contabilización automática (`PostExpenseJournalEntryUseCase`: débito la cuenta de la categoría — autocreada dinámicamente, único caso donde la cuenta no es fija de antemano — + IVA descontable si aplica, crédito Caja/Bancos) y cancelación (anula el comprobante, sin abonos que reversar). UI web en `/expenses`. Ver `apps/api/src/modules/expenses/README.md` |
| **Cobranza / cuentas por cobrar (iteración 31)** | Módulo nuevo `collections` (item 31): activa el mecanismo de venta a crédito que ya existía inerte (`method: "CREDIT"` en `SalePayment`, ya contabilizado como "Clientes" pero sin ningún registro estructurado) creando una `AccountReceivable` automática (`CreateSaleUseCase`/`AuthorizeDiscountUseCase`, vencimiento a 30 días por defecto) que se puede cobrar en persona (`POST /accounts-receivable/:id/payments`, espejo de `RegisterSupplierPaymentUseCase`) o en línea generando un link de pago Wompi (`POST .../checkout`, reusa el mismo `IPaymentGateway` genérico que ya cobra suscripciones SaaS en `modules/billing`/`saas-admin`, sin tocarlo) confirmado por un webhook propio (`POST /collections/webhooks/wompi`, ruta pública montada antes que los routers tenant-scoped, igual que el de suscripciones). Cancelar una venta a crédito cancela también su cuenta por cobrar si no tiene abonos, y la rechaza si ya los tiene. **Recordatorios automáticos** por correo (`RunCollectionsRemindersUseCase`, umbrales 3/1/0/-3/-7 días respecto al vencimiento) corriendo por empresa dentro de `tenantStorage.run` (a diferencia del poller de suscripciones, `AccountReceivable` sí es tenant-scoped). UI web en `/collections` y selector de crédito en el POS. Ver `apps/api/src/modules/collections/README.md` |
| **CRM / pipeline de negociación (iteración 32)** | Módulo nuevo `crm/opportunity` (item 32): `Quote.status` ya sugería un valor `CONVERTED` pero estaba inerte (mismo patrón que `Customer.currentBalance` del item 31), así que se construyó un modelo `Opportunity` nuevo con 4 etapas abiertas (`PROSPECTO/CONTACTO/PROPUESTA/NEGOCIACION`, movimiento libre) y 2 terminales (`GANADA/PERDIDA`, exige motivo). "Cerrar como ganada" reusa `createSaleUseCase` directo (mismo patrón de reuso cross-módulo que el resto del backend) con un pago `CREDIT` por defecto, heredando gratis la contabilización y la `AccountReceivable` automática del item 31. **Bug real encontrado y corregido**: el cálculo inicial de `expectedValue` no incluía IVA (mismo criterio, sin querer, que `PrismaQuoteRepository`) — como ese valor se usa como monto del pago `CREDIT` y `CreateSaleUseCase` exige cubrir el neto CON impuesto, esto hacía fallar el cierre siempre con productos gravados; se corrigió calculando igual que `create-sale.use-case.ts`. Si el descuento excede el límite del cajero, la venta queda `PENDING_AUTHORIZATION` hasta que un supervisor la autorice (flujo ya existente). UI web en `/crm` (tablero por etapas). Ver `apps/api/src/modules/crm/opportunity/README.md` |
| **Multi-moneda informativa (iteración 33)** | `Company.currency` era el único campo de moneda del schema y estaba completamente muerto (item 33, funcionalidad greenfield). Dado que los productos solo tienen un precio COP por catálogo y la DIAN exige el XML en COP, el alcance es etiquetado informativo: `Sale`/`Purchase` ganan `currency` (ISO 4217) + `exchangeRate` (TRM manual), pero toda la contabilidad/cuentas por cobrar-pagar/XML DIAN siguen en COP sin ningún cambio al motor de precios — `foreignTotal` es un total derivado (`totalCOP / exchangeRate`), nunca una segunda fuente de verdad. El comprobante contable gana un sufijo informativo en la `description` cuando la moneda no es COP (montos débito/crédito intactos). De regalo: se corrigió un gap real preexistente — el XML UBL nunca emitía `cbc:DocumentCurrencyCode` (exigido por el Anexo Técnico DIAN) — ahora lo emite (default COP, sin cambiar ningún XML existente salvo esa línea). UI web: selector de moneda + TRM condicional en POS y en el formulario de compra. Verificado en vivo (venta COP sin cambios, venta y compra en USD con comprobante/XML correctos) y que los 163 tests previos no se rompieron. Ver `docs/ALCANCE.md` ítem 33 para el detalle completo |
| **Facturación electrónica DIAN (iteración 4-8, 29, sin UI web todavía)** | Generación local de CUFE/CUDE/CUDS/CUNE (SHA-384) y XML por cada venta completada (desde la iteración 29, con bloque `<cac:WithholdingTaxTotal>` por cada retención RteFuente/ReteICA/ReteIVA aplicada y el monto de ReteICA finalmente wireado al CUFE — códigos de esquema DIAN sin verificar, ver README), cada nota crédito/débito que referencia una venta ya facturada, cada compra a un proveedor marcado como no obligado a facturar electrónicamente (documento soporte), **y cada empleado de cada nómina aprobada (nómina electrónica)**, con numeración DIAN (prefijo/rango/consecutivo atómico por tipo de documento; nómina usa un contador simple propio, sin resolución — ver README) separada del consecutivo interno del POS. Ventas sin cliente usan un identificador genérico de "consumidor final" (constante aislada, pendiente de verificar contra el Anexo Técnico). Firma XAdES-BES (certificado PKCS#12, probada con certificado autofirmado) y envío asíncrono a la DIAN (un poller en proceso por tipo de documento, dos servicios SOAP distintos: uno para factura/notas/documento soporte y otro para nómina) implementados pero **no verificados contra el servicio real de la DIAN** — faltan credenciales de habilitación para probarlos end-to-end. La nómina electrónica es, con diferencia, la parte menos verificada de todo el módulo: esquema XML propio no-UBL sin contrastar contra el Anexo Técnico, servicio SOAP separado sin confirmar ni en nombre, sin retención en la fuente calculada. **RIDE (representación gráfica en PDF)** implementado para los 5 tipos de documento (`GET .../pdf`, `pdfkit`, un solo layout compartido) parseando el XML ya guardado — formato del QR y layout sin verificar contra el Anexo Técnico. Ver `apps/api/src/modules/electronic-invoicing/README.md` para la lista completa de detalles sin verificar |
| **Panel administrador SaaS (iteración 12, 13, 17, 26 y 27)** | Autenticación de plataforma **separada** de la de usuarios de empresa (`PlatformAdmin`, JWT con secreto propio, sin tenant context — ver `apps/api/src/modules/saas-admin/README.md`). CRUD de planes y suscripciones, cobro/renovación (`calculateNextPeriodEnd` desde la fecha de vencimiento **original**, nunca desde la fecha del pago), vista de empresas con su suscripción, dashboard agregado (conteo por estado, próximas a vencer, ingresos del mes). Al registrar una empresa se crea automáticamente una suscripción `TRIALING` de 14 días (valor asumido, el spec no especifica la duración exacta). Poller en proceso (1h) que envía un recordatorio **real por correo** (iteración 17: `IReminderNotifier` / `ResendEmailNotifier`, vía `fetch` directo a la API de Resend, sin SDK) en 8/5/3/1/0 días antes del vencimiento y pasa automáticamente a `GRACE_PERIOD`/`SUSPENDED` según corresponda. `SubscriptionReminderLog` solo se registra si el envío tuvo éxito — un fallo (o `RESEND_API_KEY` sin configurar) deja el recordatorio pendiente para el siguiente ciclo, sin perderlo. **No probado end-to-end contra Resend real** (mismo aviso que la integración DIAN) ni contra WhatsApp (requiere verificación de negocio en Meta, fuera de alcance). UI web (login de plataforma, dashboard, planes, suscripciones, empresas) agregada en la iteración 13. **Cobro real vía Wompi/Bancolombia** (iteración 26, ver punto 27): `POST /admin/subscriptions/:id/checkout` genera un link de pago Wompi Web Checkout por redirección (el backend nunca toca datos de tarjeta, firma de integridad `SHA256(reference+amountInCents+currency+integritySecret)` verificada en vivo contra `checkout.wompi.co` con llaves de sandbox reales); `POST /admin/subscriptions/webhooks/wompi` verifica la firma del evento (`signature.checksum`) antes de tocar nada y renueva automáticamente la suscripción cuando el pago es `APPROVED`. **Autoservicio para la propia empresa** (iteración 27, módulo nuevo `billing`, permiso `billing.manage`): `GET /subscription` y `POST /subscription/checkout` reusan exactamente el mismo `CreateSubscriptionCheckoutUseCase`/`IPaymentGateway` del panel de plataforma (nada duplicado) para que cualquier empresa pague o cambie de plan sin depender de un admin de plataforma; UI web en `/billing` ("Mi suscripción"), con selector de plan cuando la empresa todavía está en `TRIAL`. Planes de suscripción (iteración 26, `seed.ts`) reemplazados por 4 planes investigados contra Siigo/Alegra/World Office/Loggro (ver `docs/PRECIOS.md`), todos con el mismo set de funcionalidad, sin módulos separados a diferencia de la competencia. Webhook de Wompi verificado solo con eventos autogenerados y firmados a mano en este entorno, **no contra un webhook real de Wompi** (requiere URL pública + pago real de sandbox por navegador, ver Despliegue más abajo) |
| **Sincronización offline (móvil, iteración 18)** | Patrón *outbox* real para ventas: `POST /sync/push` (idempotente por `clientEventId`, reusa `CreateSaleUseCase` — el mismo caso de uso de `POST /sales` — sin lógica de negocio duplicada) y `GET /sync/pull` (catálogo de productos cambiado desde el último pull). Conflictos reales (mismo `clientEventId`, payload distinto) quedan en `SyncConflictLog`. **Bug real encontrado y corregido**: Postgres JSONB no preserva el orden de las claves del payload, así que comparar con `JSON.stringify` plano daba falsos conflictos en reintentos idénticos — se usa una comparación con orden de claves normalizado. Cliente móvil (`apps/mobile`): `POSScreen` ahora lee siempre de `products_cache` local (offline-first, no directo de la API), cola `sales_outbox` con id generado localmente, motor de sync (`pull`/`push`/intervalo cada 30s mientras la app está abierta) y botón manual "Sincronizar". **Extendido en la iteración 42** a `CashMovement` (ver fila "App móvil completa" más abajo) — `PushSyncEventsUseCase` pasó de estar hardcodeado a `SALE` a un registro por `entityType` con permiso requerido por tipo. `StockMovement` sigue sin soporte (la pantalla Inventario del móvil es de solo lectura, nada que encolar). Deliberadamente **sin `@react-native-community/netinfo`** (detección real de reconexión) — no hay forma de verificar en este entorno que un módulo nativo enlace correctamente sin dispositivo/emulador; el intervalo de 30s logra el mismo resultado práctico con un retraso acotado. Verificado en vivo contra el servidor de desarrollo (push nuevo, retry idempotente, conflicto, error de producto inexistente, pull). Ver `apps/api/src/modules/sync/README.md` |
| **Seguridad (iteración 25)** | Auditoría de seguridad pre-lanzamiento con 3 hallazgos, los 3 cerrados: (1) fuga cross-tenant **confirmada** en conciliación bancaria — `addMatch()` validaba la conciliación pero no el `bankTransactionId`/`journalEntryLineId` de entrada, permitía marcar como conciliada una transacción bancaria de otra empresa adivinando/enumerando su id; (2) `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`/`JWT_PLATFORM_ADMIN_SECRET` solo exigían `min(10)` caracteres (los secretos vigentes en este entorno eran literalmente `"change-me-*"`) — se sube a `min(32)` y se regeneraron con CSPRNG fuera del repo; (3) defensa en profundidad — `authorizeItemDiscount` no validaba que el `SaleItem` perteneciera a la venta antes de mutarlo, y los repos `Electronic*`/`sync` mutaban por id sin `companyId` propio en el `where` (protegidos hasta ahora solo porque ningún caller pasaba un id ajeno) — se cambió a `updateMany` + `companyId` explícito en todos. Verificado en vivo con dos empresas reales (la fuga ya no es posible, el camino legítimo sigue funcionando) y con la suite completa |
| **Listas de precios múltiples (iteración 35)** | Catálogo `PriceList` + `ProductPriceListEntry` (override de precio por producto; sin override, precio base). Resolución compartida por venta y cotización: lista explícita del request → lista asignada al `Customer` → precio base (`resolveEffectivePriceListId`/`resolveEffectivePrice`, `modules/inventory/price-list`). `Sale`/`Quote` ganan `priceListId` informativo. Permisos `price-list.manage`/`price-list.read` (`CAJERO` solo lectura). UI: pestaña "Listas de precios" en `/inventory`, selector en el POS, campo + acción rápida de cambio en `/customers`. Ver `docs/ALCANCE.md` ítem 35 para el detalle completo |
| **Facturación recurrente a clientes (iteración 36)** | Módulo nuevo `recurring-invoices`: plantillas (`RecurringInvoice`/`RecurringInvoiceItem`, cliente/sucursal/día del mes 1-28/lista de precios opcional/plazo/productos) con poller propio (1h, mismo patrón que `collections-reminder-poller.ts`) que genera una venta real a crédito por plantilla vencida reusando `createSaleUseCase` (factura electrónica DIAN incluida gratis). Solo mensual; sin descuento por ítem (se usa una lista de precios del ítem 35 si se necesita un precio especial); precio siempre resuelto al momento de facturar. Cada corrida queda en `RecurringInvoiceRun` (éxito con el id de venta, o fallo con el error, sin bloquear otras plantillas). Permisos `recurring-invoice.manage`/`.read` (`SUPERVISOR`/`CONTADOR`, no `CAJERO`). UI en `/recurring-invoices`. Ver `docs/ALCANCE.md` ítem 36 para el detalle completo |
| **Información exógena DIAN (iteración 37)** | Módulo cross-cutting nuevo `exogena` (sin tabla propia): formatos 1001/1003 (pagos y retenciones practicadas por proveedor), 1007 (ingresos por cliente), 1008/1009 (saldos CxC/CxP actuales), como archivo plano `|`-delimitado o JSON de previsualización, gateados por `accounting.read`. Best-effort, documentado explícitamente como no validado contra el prevalidador oficial de la DIAN (`apps/api/src/modules/exogena/README.md`). Nuevos `Supplier.documentType`/`municipalityCode`, `Customer.municipalityCode`, `WithholdingConcept.dianConceptCode`. UI en `/accounting/exogena`. Ver `docs/ALCANCE.md` ítem 37 para el detalle completo |
| **Comisiones de vendedores (iteración 38)** | Módulo nuevo `commissions`, independiente de `employees`/`payroll`: `%` fijo por vendedor (`SalesCommissionScheme`), cálculo bajo demanda por mes sobre `Sale.subtotal` (`CommissionSettlement`, nunca pisa una liquidación ya `PAID`), pago contabilizado (`PostCommissionJournalEntryUseCase`, cuenta 5135 "Comisiones"). Selector de vendedor reusa el directorio de usuarios de RBAC. Permisos `commission.manage`/`.read` (`SUPERVISOR`/`CONTADOR`, no `CAJERO`). UI en `/commissions`. Ver `docs/ALCANCE.md` ítem 38 para el detalle completo |
| **Activos fijos / depreciación (iteración 39)** | Módulo nuevo `fixed-assets`: registra el activo (`FixedAsset` — costo, fecha de compra, vida útil, valor residual, sucursal) sin contabilizar su adquisición (ya pasa por Compra/Gasto). Depreciación línea recta, mensual completa, "calcular → contabilizar" en dos pasos igual que comisiones (`CalculateDepreciationUseCase`/`PostDepreciationEntryUseCase`, `DepreciationEntry` nunca pisa una fila ya `POSTED`), contabilizada con cuentas fijas "5160 Depreciación"/"1592 Depreciación acumulada". Permisos `fixed-asset.manage`/`.read` (`SUPERVISOR`/`CONTADOR`, no `CAJERO`). UI en `/fixed-assets`. Ver `docs/ALCANCE.md` ítem 39 para el detalle completo (incluye una corrección de aislamiento multi-tenant encontrada durante la implementación) |
| **API pública + webhooks salientes (iteración 40)** | Módulos nuevos `public-api`/`webhooks`: `ApiKey` (hash SHA-256, scopes ⊆ permisos de quien la crea) autenticada por `apiKeyAuthMiddleware`, que puebla el mismo `tenantStorage` que `tenantContextMiddleware` — endpoints públicos (`GET/POST /api/public/v1/{products,customers,sales}`) y todo el resto del sistema (`requirePermission`, repos) funcionan sin cambios. Webhooks salientes firmados HMAC-SHA256 (`X-Webhook-Signature`), único evento v1 `sale.created`, reenvío manual de entregas fallidas. Sin conectores nativos a Shopify/WooCommerce/Mercado Libre (requieren credenciales de desarrollador reales de cada plataforma). Gestión restringida a `ADMINISTRADOR`/`PROPIETARIO`. UI en `/integrations`. Ver `docs/ALCANCE.md` ítem 40 para el detalle completo (incluye dos correcciones encontradas durante la implementación: fuga cross-tenant en el despacho de webhooks, y un bug de enrutamiento que interceptaba rutas internas no relacionadas) |
| **WhatsApp: documentos + recordatorios (iteración 41)** | Módulo genérico nuevo `whatsapp` (puerto `IWhatsAppSender` + adaptador Meta Graph API vía `fetch`, sin SDK). Envío nuevo del RIDE de factura (al facturar una venta) y del desprendible de nómina (al aprobar un período) por WhatsApp, mejor esfuerzo, nunca bloquea. WhatsApp como canal alterno con fallback automático a email en los recordatorios de suscripción/cobranza que ya existían. `WhatsAppDeliveryLog` recibe `companyId` explícito en cada método (no vía la extensión automática de tenant) porque se escribe desde contexto tenant-scoped y platform-level a la vez. Sin permisos nuevos (reenvío manual reusa `electronic-invoicing.manage`/`payroll.approve`). Bloqueado por verificación de negocio + plantillas pre-aprobadas en Meta (mismo tipo de limitación que DIAN/Wompi/Resend). UI embebida en `/pos` y `/payroll`. Ver `docs/ALCANCE.md` ítem 41 y `apps/api/src/modules/whatsapp/README.md` para el detalle completo |
| **App móvil completa: Caja + Inventario (iteración 42)** | Tab navigator nuevo (`@react-navigation/bottom-tabs`) con Dashboard/POS/Caja/Inventario. Caja: sesión activa cacheada en SQLite (offline visible), abrir/cerrar online-only, movimientos encolados offline igual que las ventas — esto extendió `PushSyncEventsUseCase` (antes hardcodeado a `SALE`) a un registro por `entityType` con permiso requerido por tipo, corrigiendo de paso un bypass real de `cash.movement.create` que ese refactor habría heredado si no se corregía. Inventario: solo lectura, cache SQLite propia (no por el motor de sync genérico), nuevo endpoint `GET /stock/branch-stock`. Sin probar contra emulador/dispositivo real en este entorno. Ver `docs/ALCANCE.md` ítem 42 y `apps/api/src/modules/sync/README.md` para el detalle completo |

## 🧱 Ya no quedan módulos "stub" (`501 Not Implemented`)

Hasta la iteración 13, cuatro huecos seguían modelados en Prisma sin lógica de negocio real
(contabilidad: cierre de período; nómina: PDF del desprendible; proveedores/POS: consumo FIFO
real; sync: motor de sincronización). Las iteraciones 14-18 cerraron los cuatro, y la iteración 21
cerró un quinto que quedó documentado por separado: `Kardex` (historial de saldos por producto),
que hasta entonces seguía modelado en Prisma sin usarse — ver sus filas en la tabla de arriba y
los README de cada módulo para el detalle.

## 📱 Móvil (Expo)

Navegación por tabs (`@react-navigation/bottom-tabs`, iteración 42) con Dashboard/POS/Caja/
Inventario consumiendo la misma API REST, más Login en un stack pre-autenticación. POS con
sincronización offline real para ventas (iteración 18, ver fila "Sincronización offline" arriba y
`apps/api/src/modules/sync/README.md`). **Caja** (iteración 42): sesión activa cacheada en SQLite
(visible offline con el último dato conocido), abrir/cerrar sesión online-only, movimientos
encolados offline igual que las ventas (`cash_movements_outbox`) — esto extendió el motor de sync
del backend más allá de `Sale` por primera vez (`PushSyncEventsUseCase` pasó a un registro por
`entityType`, con un chequeo de permiso por tipo agregado en el mismo cambio, ver ítem 42). **Inventario**
(iteración 42): solo lectura, cache SQLite separada del motor de sync genérico (stock nuevo
endpoint `GET /stock/branch-stock`, refrescado al entrar a la pantalla / pull-to-refresh, no por
delta-since). Ninguna pantalla móvil se probó contra un emulador/dispositivo real en este entorno
— verificación limitada a `tsc --noEmit`/`eslint` y, del lado del backend, contra Postgres local.
**Sesión persistida** (iteración 24, `useAuthStore.ts`): antes el login se perdía en cada
reinicio de la app (estado solo en memoria); ahora se persiste en `AsyncStorage`
(`@react-native-async-storage/async-storage`, versión resuelta por `expo install` para SDK 51)
via el middleware `persist` de zustand, mismo criterio que ya usa `apps/web` con `localStorage`.
`RootNavigator` espera a que la hidratación termine (`hasHydrated`) antes de decidir la ruta
inicial, y si hay una sesión guardada intenta refrescar el `accessToken` una vez al arrancar
(dura 15 min, casi seguro vencido si la app llevaba rato cerrada) usando el `refreshToken` (dura
30 días) — si el refresh falla, la sesión se limpia y manda a Login. `apiFetch` también reintenta
una vez con refresh en cualquier `401`, mismo patrón que `apps/web/src/lib/api-client.ts`. Botón
"Salir" agregado en el Dashboard para poder cerrar sesión desde la UI. Verificado únicamente con
`tsc --noEmit` y `eslint` (sin emulador/dispositivo en este entorno, mismo criterio que el resto
del móvil) — no se probó en runtime que la sesión sobreviva un reinicio real de la app.

## 🚀 Despliegue (iteración 27)

Objetivo: que vender el producto sea "agregar/instalar", no un proceso manual por cliente —
resuelto con SaaS multi-tenant en la nube (ya era la arquitectura del proyecto) más un Blueprint
de un clic en Render, en vez de un instalador de escritorio por empresa. `render.yaml` (raíz del
repo) declara los 3 servicios (`contapro-db` Postgres, `contapro-api` con `preDeployCommand:
prisma migrate deploy`, `contapro-web` estático con rewrite SPA) y genera los secretos JWT solos
(`generateValue: true`); las credenciales de terceros (DIAN, Resend, Wompi producción, Supabase)
quedan `sync: false` — se cargan a mano en el dashboard, nunca en el repo. Seed separado en dos
scripts para no llevar datos demo a producción: `seed-base.ts` (permisos/roles/planes reales,
compartido) vs. `seed.ts` (agrega la empresa/usuarios/productos demo encima, solo para desarrollo
local) vs. `seed-production.ts` (`pnpm db:seed:production`, solo `seed-base`). El primer
`PlatformAdmin` real se crea con `create-platform-admin.ts` (CLI, no expuesto por HTTP). Guía
completa paso a paso en `docs/DESPLIEGUE.md`. **No ejecutado todavía** — aplicar el Blueprint en
el dashboard de Render es una acción manual que solo puede hacer el dueño de la cuenta.

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
   (ver punto 19). ~~Persistencia de sesión en el móvil~~ — implementada en la iteración 24 (ver
   punto 26). Queda: `CashMovement`/`StockMovement` como entidades sincronizables (sin UI ni tabla
   local todavía), NetInfo real.
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
    en vez de bloquear la venta. Ver `apps/api/src/modules/suppliers/README.md` para el detalle
    (ver punto 22 para Kardex, punto 23 para Devoluciones y punto 25 para `StockMovement` por
    lote — ambos pendientes en su momento, ya resueltos).
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
    (`CashMovement`/`StockMovement` sincronizables, NetInfo real). Persistencia de sesión móvil
    implementada en la iteración 24 (ver punto 26).
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
23. ~~Proveedores: Devoluciones no restaura lotes~~ — implementado en la iteración 22
    (`modules/pos/return`). El módulo de Devoluciones (`Return`/`ReturnItem`) estaba modelado en
    Prisma desde el scaffold inicial (junto con `SaleStatus.RETURNED_PARTIAL`/`RETURNED_FULL`,
    `StockMovementType.RETURN_IN`/`RETURN_OUT` y `AuditAction.RETURN_CREATED`) pero no existía en
    absoluto — `cancel-sale.use-case.ts` y `suppliers/README.md` lo referenciaban como si ya
    restaurara stock, documentación adelantada a código que nunca se escribió. Ahora
    `POST /returns` (permiso nuevo `return.create`, no otorgado a CAJERO por defecto, mismo
    criterio que `sale.cancel`) registra una devolución parcial/total sobre una venta
    `COMPLETED`/`RETURNED_PARTIAL`: valida contra lo ya devuelto antes (dentro de la misma
    transacción Prisma, evita sobregiro concurrente, mismo criterio que
    `RegisterSupplierPaymentUseCase`), restaura stock por item (`StockMovement RETURN_IN` +
    `Kardex`, lote nuevo si el producto rastrea lotes — no reinserta en el lote FIFO original
    consumido, ver punto 1 de `suppliers/README.md`, resuelto en la iteración 23 pero solo para
    trazabilidad de salida, no para reinsertar en el lote de origen al devolver), permite
    marcar un item como no restockeable (mercancía dañada, sin efecto de inventario pero sí cuenta
    para el tope de cantidad devuelta), actualiza `Sale.status`
    (`RETURNED_PARTIAL`/`RETURNED_FULL`), y contabiliza el reverso (`PostReturnJournalEntryUseCase`,
    espejo de `PostSaleJournalEntryUseCase`, con `refundMethod` explícito en vez de reconstruir la
    mezcla de pagos original). Sin `CashMovement` automático todavía. UI web agregada después (ver
    punto 24 más abajo). Verificado en vivo end-to-end: devolución parcial y total sobre una
    venta de dos productos (uno con `tracksBatches`/`FIFO`), exceso de cantidad rechazado (422),
    doble devolución tras `RETURNED_FULL` rechazada, item no restockeado sin efecto de inventario,
    lote nuevo creado con el costo correcto, comprobantes contables balanceados y `POSTED` para los
    tres `refundMethod` (`CASH`→Caja, `TRANSFER`→Bancos, `CREDIT_TO_ACCOUNT`→Clientes), bloqueo por
    permisos (`CAJERO` recibe 403 en `POST /returns`, sí puede `GET /returns`).
24. ~~UI web de Devoluciones~~ — agregada en la página de Cotizaciones/notas (`/quotes-notes`,
    `QuotesAndNotesPage.tsx`): selector de venta (solo `COMPLETED`/`RETURNED_PARTIAL`), tabla por
    item con vendido/ya devuelto/cantidad a devolver/checkbox de reposición (calculado cliente-side
    a partir de `GET /returns?saleId=`), motivo, medio de reembolso, e historial de devoluciones.
    Permiso `return.create` agregado al gate del nav item existente. Verificado en navegador
    (Playwright headless, instalado ad-hoc, no quedó como dependencia del repo): login, selección
    de venta, envío de devolución y actualización de la lista sin errores de consola.
25. ~~Proveedores: `StockMovement` por lote consumido en venta FIFO~~ — implementado en la
    iteración 23 (ver "Consumo FIFO real" en `suppliers/README.md`, punto 1 de "Que falta
    implementar"). Antes una venta FIFO que consumía varios lotes generaba una sola línea de
    `StockMovement`/`Kardex` agregada por item; ahora `consumeFifoBatches` devuelve un segmento
    por cada lote realmente tocado (`batchId`, cantidad, costo real de ese lote) y
    `applyCompletionSideEffects` crea una línea de `StockMovement` + `Kardex` por segmento, con el
    saldo verdaderamente decreciente lote a lote. Efecto secundario corregido en el mismo cambio:
    el módulo de Devoluciones ubicaba el costo original de la venta con `findFirst` sobre
    `StockMovement`, lo que ahora podía traer el costo de un solo lote en vez del real cuando una
    venta tocó varios — se cambió a `findMany` + promedio ponderado por cantidad. Sigue pendiente
    (fuera de alcance de esta iteración): una devolución sigue creando un lote nuevo en vez de
    reinsertar en el lote FIFO original exacto (ver punto 1 de `suppliers/README.md` para el
    razonamiento). Verificado en vivo end-to-end: venta que consumió 3 lotes distintos en una sola
    línea (incluido un lote generado por una devolución previa, agotado primero por ser el más
    antiguo), 3 `StockMovement`/`Kardex` con costo y saldo correctos por segmento, `Product.
    currentCost` actualizado al lote restante, producto no-FIFO sigue generando una sola línea sin
    cambios, y devolución posterior de esa misma venta reingresando al costo promedio ponderado
    correcto (1225 = (1×1000 + 2×1200 + 1×1500) / 4).
26. ~~Móvil: persistencia de sesión~~ — implementado en la iteración 24 (ver fila "Móvil (Expo)"
    arriba para el detalle completo). Resumen: `useAuthStore` pasó de estado en memoria a
    persistido en `AsyncStorage` vía el middleware `persist` de zustand; `RootNavigator` espera la
    hidratación y refresca el `accessToken` proactivamente al arrancar usando el `refreshToken`
    guardado; `apiFetch` también reintenta una vez con refresh en cualquier `401` (mismo patrón
    que `apps/web`); botón "Salir" agregado en el Dashboard. Verificado con `tsc --noEmit` y
    `eslint` únicamente — sin emulador/dispositivo en este entorno, no se probó en runtime que la
    sesión sobreviva un reinicio real de la app.
27. ~~Panel SaaS: cobro real de suscripciones~~ — implementado en la iteración 26 (ver fila "Panel
    administrador SaaS" arriba): integración con Wompi/Bancolombia (Web Checkout por redirección,
    webhook con verificación de firma), y precios de planes reemplazados por 4 planes investigados
    contra la competencia (`docs/PRECIOS.md`). Iteración 27 sumó el autoservicio: cualquier empresa
    paga o cambia de plan por sí misma desde `/billing` (`modules/billing`, permiso
    `billing.manage`), sin depender de un admin de plataforma — reusa el mismo caso de uso de
    checkout del panel, sin duplicar lógica. Queda pendiente verificar el webhook contra un pago
    real de Wompi por navegador (necesita URL pública, ver punto 28) y credenciales Wompi de
    producción (hoy solo probado con llaves de sandbox).
28. **Despliegue en producción** — preparado en la iteración 27 (ver sección "🚀 Despliegue"
    arriba): Blueprint declarativo de Render (`render.yaml`) para que instalar el producto en un
    cliente nuevo sea crear una empresa vía `/register`, no una instalación aparte por cliente.
    Seed de producción separado del demo (`seed-base.ts`/`seed-production.ts`), script de alta del
    primer `PlatformAdmin` real (`create-platform-admin.ts`), guía paso a paso
    (`docs/DESPLIEGUE.md`). **No ejecutado todavía**: aplicar el Blueprint en el dashboard de
    Render y cargar las credenciales de producción (DIAN, Resend, Wompi) son acciones manuales que
    solo puede hacer el dueño de la cuenta — fuera del alcance de lo que se puede automatizar
    desde este entorno.

### Brecha funcional vs. Alegra/Siigo (análisis 2026-08-05, pendiente de cerrar una por una)

Comparación funcional contra las páginas públicas de Alegra y Siigo (no comparación de código —
Contapro no reutiliza ni se basa en el código de ninguno de los dos). En el núcleo contable duro
(partida doble, cierre de período, FIFO/Kardex, nómina electrónica, RBAC granular, auditoría
inmutable, aislamiento multi-tenant) Contapro ya iguala o supera lo que documentan ambos. Las
brechas reales están en superficie comercial/cobranza y en módulos que ni siquiera están
modelados en Prisma todavía (a diferencia de la iteración 1, donde todo el dominio faltante ya
estaba en el schema). Orden de prioridad decidido por valor de negocio típico de una pyme
colombiana — se va cerrando uno a uno, cada uno se convierte en su propia iteración numerada
cuando se implemente, mismo criterio que la lista de arriba:

29. ~~Retención en la fuente / ICA / IVA en factura de venta~~ — implementado en la iteración 29
    (2026-08-05), en ambas direcciones (venta **y** compra, no solo venta como decía el análisis
    original — se amplió el alcance al implementarlo): nuevo catálogo `WithholdingConcept` por
    empresa (`GET/POST /withholding-concepts`, `PATCH .../:id`, `POST .../:id/deactivate`,
    permisos `accounting.manage`/`.read` reusados, 6 conceptos por defecto sembrados al registrar
    una empresa — ver `modules/accounting/README.md` para el detalle completo). Ventas: retención
    es un **activo** (anticipo de impuestos, cuentas 135515/135517/135518) porque el cliente es
    quien retiene; compras: retención es un **pasivo** (236540/236801/236705) porque la empresa es
    quien retiene a su proveedor, y `AccountPayable` queda neto de retención desde su creación sin
    tocar `RegisterSupplierPaymentUseCase` ni `CancelPurchaseUseCase`. XML UBL de venta gana un
    bloque `<cac:WithholdingTaxTotal>` por tipo y el monto de ReteICA por fin se pasa al CUFE (el
    slot ya existía, antes fijo en 0) — ver `modules/electronic-invoicing/README.md` para los
    códigos de esquema DIAN sin verificar. UI web: desglose y selector de retenciones en POS
    (gateado por `accounting.read`, checkout de CAJERO sin cambios visuales) y en el formulario de
    compras, más una pestaña nueva "Retenciones" en Contabilidad para el CRUD del catálogo.
    **Hallazgo de seguridad real durante la verificación en vivo**: `WithholdingConcept` se
    implementó sin registrarlo en `TENANT_MODELS`
    (`apps/api/src/shared/prisma/tenant.extension.ts`) — el listado devolvía los conceptos de
    **todas** las empresas mezclados (detectado porque la empresa demo mostraba 30 conceptos en
    vez de 6), corregido antes de dar por cerrado el ítem. Documento soporte de compras (proveedor
    no obligado a facturar) queda sin retenciones — seguimiento menor, no bloqueante. Verificado
    en vivo end-to-end contra Postgres local (venta y compra con retención, XML con
    `WithholdingTaxTotal`, abono y cancelación de compra retenida sin tocar código, concepto
    inactivo/inexistente rechazado, período cerrado sigue bloqueando) — **sin verificar en
    navegador** (sin Chrome disponible en este entorno para esta sesión), solo `tsc`/`vitest`
    (130 tests) + `vite build` para el frontend.
30. ~~Gastos operativos (módulo nuevo `expenses`)~~ — implementado en la iteración 30
    (2026-08-05). Confirmado que no se podía reusar nada existente: `Purchase` siempre debita la
    cuenta fija de inventario y `AccountPayable` es obligatorio; `CashMovement` no genera ningún
    `JournalEntry` y requiere una `CashSession` abierta. Módulo nuevo con catálogo de categorías
    de gasto por empresa (`ExpenseCategory`, 7 por defecto, mismo mecanismo de siembra que
    `WithholdingConcept` del ítem 29) y `Expense` (`payeeName` libre, explícitamente no un
    `Supplier`). Decisión de alcance confirmada con el usuario: un gasto siempre se registra ya
    pagado (efectivo/tarjeta/transferencia), sin cuentas por pagar de gastos ni abonos — cubre
    arriendo/servicios/reembolsos, que es lo que pedía este ítem. `PostExpenseJournalEntryUseCase`
    (`modules/accounting`) resuelve la cuenta de la categoría dinámicamente con `upsertByCode`
    (único caso de uso del repo donde la cuenta no es fija de antemano); la categoría por defecto
    "Diversos" reutiliza a propósito la cuenta `5195` que ya usaba
    `PostCashSessionAdjustmentJournalEntryUseCase` para faltantes de caja. **Lección del ítem 29
    aplicada desde el inicio**: `ExpenseCategory`/`Expense` se agregaron a `TENANT_MODELS`
    (`tenant.extension.ts`) en el mismo paso que se crearon los modelos — verificado en vivo que
    el aislamiento multi-tenant funcionó correctamente desde el primer intento, sin el hallazgo
    tardío que hubo la vez pasada. Ver `apps/api/src/modules/expenses/README.md`.
31. ~~Cobranza de facturas de venta con pago en línea + recordatorios automáticos~~ — implementado
    en la iteración 31 (2026-08-05). Hallazgo clave que simplificó el diseño: el mecanismo de
    venta a crédito ya existía pero estaba inerte (`method: "CREDIT"` en `SalePayment` ya
    satisfacía la validación de pago y ya se contabilizaba como "Clientes" en
    `PostSaleJournalEntryUseCase`) — no hizo falta tocar la validación de `CreateSaleUseCase`,
    solo engancharse a ese `CREDIT` existente. Módulo nuevo `collections`: `AccountReceivable`
    generada automáticamente al completarse una venta con pago `CREDIT` (dentro de la misma
    transacción que `PrismaSaleRepository.create()`, exige `customerId`, vencimiento a 30 días por
    defecto); cobro en persona (`POST /accounts-receivable/:id/payments`, espejo de
    `RegisterSupplierPaymentUseCase`) y en línea (`POST .../checkout`, reusa sin cambios el mismo
    `IPaymentGateway` genérico que ya cobra suscripciones SaaS) con webhook propio
    (`POST /collections/webhooks/wompi`, ruta pública montada antes que los routers tenant-scoped,
    resuelve el `companyId` por `reference` con `basePrisma` y entra en `tenantStorage.run` para
    el resto — mismo truco que ya usa el poller de DIAN). Cancelar una venta a crédito cancela su
    cuenta por cobrar si no tiene abonos, la rechaza si ya los tiene. Recordatorios automáticos por
    correo con la lógica del poller de suscripciones (umbrales de días, log de deduplicación
    solo-si-tuvo-éxito) pero la tenencia del poller de DIAN (`AccountReceivable` sí es
    tenant-scoped, a diferencia de `Subscription`) — puerto de notificación propio
    (`ICollectionReminderNotifier`), no reusa `IReminderNotifier` porque ese ya está atado al
    shape/HTML de suscripciones. **Bug real encontrado y corregido en la verificación en vivo**:
    `AccountReceivablePayment` se agregó por error a `TENANT_MODELS` a pesar de no tener columna
    `companyId` propia (se protege vía su `AccountReceivable` padre, igual que `SupplierPayment`)
    — la extensión de tenant intentaba inyectarle un `companyId` inexistente y Prisma rechazaba
    todo `create()`; se detectó al registrar el primer abono y se corrigió antes de cerrar el
    ítem. `Customer.email` se guardaba desde el alta pero ningún caso de uso lo leía hasta ahora
    (necesario para el checkout). UI web en `/collections` y selector de crédito en el POS.
    Verificado en vivo end-to-end (venta a crédito, abono manual, checkout, webhook simulado con
    firma de sandbox, cancelación con y sin abonos, permisos, lógica de recordatorio con el
    camino de fallo esperado dado que Resend no está configurado en este entorno). Ver
    `apps/api/src/modules/collections/README.md`.
32. ~~CRM básico (pipeline de negociación)~~ — implementado en la iteración 32 (2026-08-06).
    Hallazgo clave: `Quote.status` ya tenía un comentario sugiriendo un valor `CONVERTED`, pero
    estaba completamente inerte (ningún caso de uso lo escribe, `Sale` no tiene ninguna relación
    con `Quote`) — mismo patrón que `Customer.currentBalance` en el item 31, así que se construyó
    un modelo `Opportunity` nuevo en vez de resucitarlo. Módulo nuevo `crm/opportunity`: pipeline
    con 4 etapas abiertas (`PROSPECTO/CONTACTO/PROPUESTA/NEGOCIACION`, movimiento libre entre
    ellas) y 2 terminales (`GANADA/PERDIDA`, exige motivo). "Cerrar como ganada" reusa
    `createSaleUseCase` directo (mismo patrón de reuso cross-módulo que `accounting.container.ts`)
    con un pago `CREDIT` por defecto — hereda gratis la contabilización, la `AccountReceivable`
    automática (item 31) y el intento de facturación electrónica, sin duplicar ninguna lógica de
    venta/cobro. **Bug real encontrado y corregido en la verificación en vivo**: el cálculo inicial
    de `expectedValue`/`OpportunityItem.total` no incluía IVA (mismo criterio que
    `PrismaQuoteRepository`, que tampoco lo calcula) — como ese valor se usa directo como monto del
    pago `CREDIT`, y `CreateSaleUseCase` exige cubrir el neto CON impuesto, esto habría hecho
    fallar el cierre en el 100% de los casos con productos gravados, no solo como caso borde; se
    corrigió buscando el `taxRate` vigente del producto al crear la oportunidad (igual que
    `PrismaQuoteRepository` busca `currentPrice`) y calculando igual que
    `create-sale.use-case.ts`. Si el descuento negociado excede el límite del cajero que cierra, la
    venta queda `PENDING_AUTHORIZATION` (la oportunidad igual pasa a `GANADA` con `saleId`
    enlazado) hasta que un supervisor autorice, mismo flujo ya existente. Permisos nuevos
    `opportunity.manage`/`opportunity.read`, otorgados a `SUPERVISOR` y `CAJERO` (mismo criterio
    que `customer.manage`/`quote.create`). UI web en `/crm`: tablero por columnas de etapa +
    sección de ganadas/perdidas. Limitaciones documentadas (decisión consciente de no tocar
    `CreateSaleUseCase`, código compartido y ya probado): el precio negociado no se preserva si el
    catálogo cambió entre la creación y el cierre (siempre se re-cotiza al precio vigente), y la
    venta resultante queda atribuida a quien cierra, no a `Opportunity.ownerUserId`. Verificado en
    vivo end-to-end (creación, movimientos de etapa válidos/inválidos, cierre exitoso con asiento
    contable y cuenta por cobrar correctos, caso borde de autorización de descuento, aislamiento
    multi-tenant, permisos, auditoría). Ver `apps/api/src/modules/crm/opportunity/README.md`.
33. ~~Multi-moneda~~ — implementado en la iteración 33 (2026-08-06). Hallazgo clave: `Company.currency`
    era el único campo de moneda en las 17 archivos del schema, y estaba completamente muerto
    (ningún caso de uso lo leía ni lo escribía) — funcionalidad enteramente greenfield. Dado que el
    catálogo de productos solo tiene un precio COP por producto (sin lista de precios por moneda) y
    la DIAN exige legalmente que la factura electrónica quede en COP, el alcance implementado es
    **etiquetado informativo**: `Sale`/`Purchase` ganan `currency` (ISO 4217) + `exchangeRate` (TRM
    manual, sin fetch automático en esta primera versión), pero toda la contabilidad, las cuentas
    por cobrar/pagar y el XML DIAN siguen calculándose en COP exactamente igual que antes — cero
    cambios al motor de precios. El total en la moneda extranjera (`foreignTotal`) es un valor
    **derivado** (`totalCOP / exchangeRate`), nunca una segunda fuente de verdad. El comprobante
    contable gana un sufijo informativo en la `description` cuando la moneda no es COP (ej. "Venta
    #45 (USD 500 @ TRM 4200)"), sin tocar los montos débito/crédito. De regalo (mismo archivo que ya
    se tocaba): se corrigió un gap real preexistente — `ubl-invoice-xml-builder.ts` nunca emitía el
    encabezado `cbc:DocumentCurrencyCode` que exige el Anexo Técnico DIAN; ahora lo emite (default
    `"COP"`, no cambia ningún XML existente salvo por esa línea nueva), mientras los `currencyID="COP"`
    de los montos legales quedan igual a propósito. Los campos nuevos en `SaleJournalEntryInput`/
    `PurchaseJournalEntryInput`/`UblInvoiceInput` son opcionales (default interno COP/1) para no
    tocar ningún fixture de test existente — verificado que los 163 tests previos siguieron pasando
    sin modificación antes de agregar los 10 nuevos. UI web: selector de moneda (COP/USD/EUR) + TRM
    condicional en el POS y en el formulario de registrar compra, con el total de referencia
    mostrado junto al total en COP. Verificado en vivo end-to-end: venta COP sin cambios (regresión:
    mismo comprobante, XML gana solo el header nuevo), venta y compra en USD con TRM manual
    (`currency`/`exchangeRate`/`foreignTotal` correctos, comprobante contable anotado con montos
    débito/crédito idénticos a una operación COP equivalente, XML con `DocumentCurrencyCode=USD` y
    montos legales en COP). Fuera de alcance, documentado: TRM automática (solo entrada manual),
    precios de producto por moneda, líneas de comprobante contable denominadas en moneda extranjera,
    y `Company.currency` sigue sin reactivarse como moneda base/lista de monedas permitidas por
    empresa (follow-up aditivo separado si se necesita).
34. ~~Centros de costo~~ — implementado en la iteración 34 (2026-08-06). Hallazgo clave: `JournalEntry`
    ya tenía un campo `branchId` (nullable) desde la iteración 1 que en teoría permitiría
    "segmentar por sucursal", pero estaba completamente inerte — se persistía al crear el
    comprobante pero ningún reporte lo leía ni lo filtraba, y no había ningún selector en la UI
    (mismo patrón de columna muerta que `Company.currency` en el item 33). Para no repetir ese
    error, el filtro en reportes se tomó como parte obligatoria de este ítem, no como un extra
    opcional. Nuevo catálogo `CostCenter` (mirror exacto de `WithholdingConcept`: código/nombre/
    activo, CRUD dentro del módulo `accounting`, sin permiso nuevo). `JournalEntry` gana
    `costCenterId` nullable, etiquetable en dos caminos contenidos: comprobante manual
    (`POST /journal-entries`) y gastos operativos (`expenses`, item 30 — el caso de uso de libro
    de texto para centros de costo, y al ser un registro 1:1 sin carrito el cambio fue pequeño).
    Estado de Resultados y Libro Mayor ganan un filtro opcional `costCenterId` (mismo patrón que el
    selector de cuenta que el Libro Mayor ya tenía) — sin seleccionar ninguno, el comportamiento es
    idéntico al de antes (regresión verificada). Explícitamente fuera de alcance, documentado: los
    otros 7 `Post*JournalEntryUseCase` (venta/compra/nómina/devolución/abono a proveedor/cobro/
    ajuste de caja) — `branchId` ya es su dimensión natural de segmentación, y sumarles centro de
    costo exigiría agregar el concepto también a cada dominio de origen (carrito de venta, nómina
    por empleado, etc.), una expansión mucho mayor no justificada por este ítem. Balance General y
    Flujo de caja tampoco ganan filtro (la práctica contable estándar segmenta el Estado de
    Resultados por centro de costo, no las cuentas de balance). UI web: nueva pestaña "Centros de
    costo" en `/accounting` (CRUD), selector en el comprobante manual y en el formulario de
    registrar gasto, filtro en Estado de Resultados/Libro Mayor. Verificado en vivo end-to-end: dos
    centros de costo creados, comprobante manual y gasto etiquetados cada uno con uno distinto,
    Estado de Resultados y Libro Mayor filtrados muestran exactamente las líneas del centro
    seleccionado (y todo sin filtrar), validación rechaza un centro de costo inactivo (422) o
    inexistente (404), aislamiento multi-tenant del catálogo, regresión confirmada (comprobante sin
    `costCenterId` sigue devolviendo `null` igual que siempre). Los 182 tests previos no se
    rompieron (9 nuevos).
35. ~~Listas de precios múltiples~~ — implementado en la iteración 35 (2026-08-06). Hallazgo clave de
    la exploración: funcionalidad enteramente greenfield, sin ningún campo/columna muerta previa
    (a diferencia de `Company.currency`/`JournalEntry.branchId` en los items 33/34) — solo dos
    sitios en todo el backend calculaban un monto a partir de `Product.currentPrice`
    (`CreateSaleUseCase` y `PrismaQuoteRepository`), ninguno con un resolver compartido. Nuevo
    catálogo `PriceList` (mirror de `WithholdingConcept`/`CostCenter`) + `ProductPriceListEntry`
    (override de precio por producto dentro de una lista; sin fila para un producto, se usa el
    precio base). Resolución de la lista efectiva compartida por venta y cotización (funciones
    puras `resolveEffectivePriceListId`/`resolveEffectivePrice`): lista explícita del request
    (el cajero fuerza una lista puntual) → lista asignada al `Customer` seleccionado → sin
    ninguna de las dos, precio base (`null`, idéntico al comportamiento anterior a este ítem).
    `Customer.priceListId` nullable, asignable en el alta y editable después con un endpoint
    angosto de un solo campo (`PATCH /customers/:id/price-list`, mismo criterio que
    `PATCH /products/:id/price` — el módulo `customers` no tiene edición general). `Sale`/`Quote`
    ganan `priceListId` nullable informativo, para trazabilidad de con qué lista se facturó.
    Permisos nuevos `price-list.manage`/`price-list.read` (módulo `inventory`): `SUPERVISOR`
    recibe ambos, `CAJERO` solo `.read` (puede ver/elegir listas al vender, no crearlas ni fijar
    precios — misma distinción que `product.read` vs `product.price.update`). UI web: nueva
    pestaña "Listas de precios" en `/inventory` (CRUD + tabla de precios por producto editable),
    selector de lista en el POS (el carrito recalcula localmente el total contra los overrides de
    la lista elegida, precio base por defecto o la lista del cliente seleccionado si tiene una
    asignada), campo de lista + acción rápida de cambio en `/customers`. Verificado en vivo
    end-to-end: dos listas con overrides distintos para el mismo producto, venta sin cliente/sin
    lista (regresión, precio base), venta con lista explícita con y sin override para el producto,
    venta con cliente con lista asignada resolviendo automáticamente sin `priceListId` explícito,
    lista explícita ganando sobre la del cliente, mismos cinco escenarios repetidos en cotización,
    `priceListId` persistido correctamente en todos los casos, `CAJERO` puede leer listas (200)
    pero no crearlas/editarlas (403), aislamiento multi-tenant del catálogo confirmado con una
    segunda empresa. Los 199 tests previos no se rompieron (17 nuevos, incluyendo los dos
    resolvers puros y `CreateQuoteUseCase`, que hasta este ítem no tenía specs por no tener lógica
    condicional propia). Fuera de alcance, documentado: precios escalonados por cantidad, listas
    de precios por sucursal, y vigencia temporal de una lista (activo/inactivo es el único estado).
36. ~~Facturación recurrente a clientes~~ — implementado en la iteración 36 (2026-08-06). El motor
    de recurrencia que ya existía (`saas-admin`/`billing`) es cross-tenant y cobra a la EMPRESA
    misma por su suscripción de Contapro — no aplica aquí, que factura a los CLIENTES de cada
    empresa (tenant-scoped); hallazgo greenfield, sin scaffolding previo, mismo patrón que los
    ítems 33-35. Nuevo módulo `recurring-invoices`: catálogo de plantillas (`RecurringInvoice` +
    `RecurringInvoiceItem`, cliente/sucursal/día del mes 1-28/lista de precios opcional/días de
    plazo/productos) con un poller propio (`setInterval` 1h, mismo patrón que
    `collections-reminder-poller.ts`) que, por cada plantilla vencida, genera una venta real a
    crédito reutilizando `createSaleUseCase` (el mismo caso de uso de `POST /sales`) — la factura
    electrónica DIAN sale gratis, ya está invocada dentro de `CreateSaleUseCase.execute()`. Decisiones
    de alcance: solo frecuencia mensual con día fijo (1-28); sin `discountPercent` en los ítems de
    la plantilla (un precio especial se logra con una lista de precios del ítem 35, no con un
    descuento ad-hoc en un job desatendido); pago siempre `CREDIT` (un proceso automático no puede
    "recibir efectivo" — genera una `AccountReceivable`, ítem 31, que el cliente paga después con
    el flujo de cobranza existente); sin retenciones; precio siempre resuelto al momento de
    facturar, nunca congelado en la plantilla. Cada ejecución queda registrada
    (`RecurringInvoiceRun`, éxito con el id de la venta generada o fallo con el mensaje de error) y
    un fallo en una plantilla no bloquea a las demás ni dentro de la misma empresa ni entre
    empresas (mismo criterio de aislamiento por-empresa que el resto de los pollers). UI web:
    nueva página `/recurring-invoices` (alta de plantilla, tabla con próxima/última ejecución,
    desactivar, historial de ejecuciones por plantilla). Verificado en vivo end-to-end disparando
    el caso de uso del poller manualmente (sin esperar el intervalo real): venta a crédito generada
    con el total exacto (precio × cantidad + IVA), `AccountReceivable` con el vencimiento correcto,
    `nextRunDate` avanzado un mes exacto tras el éxito; camino de fallo (producto inexistente)
    registrado sin avanzar `nextRunDate`; `CAJERO` sin acceso (403), `CONTADOR`/`SUPERVISOR` con
    acceso completo; aislamiento multi-tenant del catálogo confirmado con una segunda empresa. Los
    199 tests previos no se rompieron (8 nuevos: `calculate-next-run-date.spec.ts` y
    `run-recurring-invoices.use-case.spec.ts`).
37. ~~Información exógena DIAN~~ — implementado en la iteración 37 (2026-08-06). Módulo
    cross-cutting nuevo `exogena` (sin tabla propia, agrega datos ya existentes de `suppliers`
    /`pos/sale`/`collections`): formatos **1001** (pagos a proveedores + retención practicada, por
    proveedor), **1003** (detalle de retenciones practicadas, por proveedor y concepto), **1007**
    (ingresos, por cliente), **1008**/**1009** (saldos de cuentas por cobrar/pagar, saldo actual
    del sistema). Generados como archivo plano delimitado por `|` (`GET
    /reports/exogena/<formato>/download`, convención real de los archivos DIAN) o JSON de
    previsualización (`GET /reports/exogena/<formato>`), gateados por `accounting.read` (sin
    permiso nuevo). Gaps de datos reales llenados: `Supplier.documentType` (default `"NIT"`,
    backfill automático), `Supplier.municipalityCode`/`Customer.municipalityCode` (código DANE,
    nuevos), `WithholdingConcept.dianConceptCode` (código numérico DIAN de retención, nuevo).
    **Documentado explícitamente como best-effort, no validado contra el prevalidador oficial de
    la DIAN** (mismo criterio que `electronic-invoicing`, ver `apps/api/src/modules/exogena/
    README.md` § "Limitaciones e items sin verificar"): concepto de pago del formato 1001 genérico
    y fijo (el catálogo de productos no clasifica compras por concepto DIAN), nombre no separado en
    apellidos/nombres, país fijo Colombia, saldos de 1008/1009 son el saldo *actual* del sistema
    (no un snapshot histórico real al 31 de diciembre, el sistema no versiona el saldo en el
    tiempo), terceros sin `municipalityCode` se incluyen igual pero marcados `incompleto` en la
    previsualización. UI web: página `/accounting/exogena` (selector de año + tabs por formato +
    descarga), campos nuevos en el alta de proveedor/cliente y en retenciones. Verificado en vivo
    end-to-end: proveedor completo vs. incompleto, compra con retención (1001/1003/1009 con los
    montos exactos, incluyendo que `AccountPayable` queda neto de retención — comportamiento ya
    existente desde el ítem de proveedores), venta con cliente (1007/1008), descarga con
    `Content-Type`/`Content-Disposition` correctos y contenido idéntico a la previsualización JSON,
    año sin datos devuelve lista vacía, `CAJERO` sin acceso (403). Los 207 tests previos no se
    rompieron (12 nuevos: `exogena-report.service.spec.ts`, `generate-flat-file.spec.ts`).
38. ~~Comisiones de vendedores~~ — implementado en la iteración 38 (2026-08-06). Módulo nuevo
    `commissions`, independiente de `employees`/`payroll` (no todo vendedor tiene un `Employee`
    formal — `Sale.sellerUserId` es cualquier `User`, sin relación a `Employee`). `%` fijo por
    vendedor (`SalesCommissionScheme`, único por `[companyId, sellerUserId]`); cálculo bajo
    demanda por período mensual (`POST /commissions/calculate`) que suma `Sale.subtotal` (ventas
    `COMPLETED`/`RETURNED_PARTIAL` del mes, antes de IVA) por vendedor y genera/actualiza un
    `CommissionSettlement` por esquema activo — recalcular un período actualiza montos pero nunca
    pisa una liquidación ya `PAID`; vendedores sin ventas ese mes no generan fila. Pago
    contabilizado (`PostCommissionJournalEntryUseCase`, calco de `PostExpenseJournalEntryUseCase`
    sin IVA: débito cuenta 5135 "Comisiones", crédito Caja/Bancos según método). Selector de
    vendedor reusa `IUserDirectoryRepository` de RBAC (cualquier usuario activo, sin filtrar por
    rol) en vez de un catálogo propio. Permisos `commission.manage`/`.read`
    (`SUPERVISOR`/`CONTADOR`, no `CAJERO`). UI en `/commissions` (tabs Liquidaciones/Esquemas).
    Verificado en vivo end-to-end: esquema 5% + dos ventas del cajero, cálculo del período con el
    monto exacto, pago con comprobante contable correcto (débito 5135, crédito caja) y
    `status=PAID`, recálculo del mismo período confirma que la liquidación pagada no cambia,
    `CAJERO` sin acceso (403), aislamiento multi-tenant. Los 219 tests previos no se rompieron (7
    nuevos: `calculate-commissions.use-case.spec.ts`, `pay-commission-settlement.use-case.spec.ts`).
39. ~~Activos fijos / depreciación~~ — implementado en la iteración 39 (2026-08-06). Módulo nuevo
    `fixed-assets`. **No contabiliza la adquisición del activo** (eso ya pasa por Compra a
    proveedor o Gasto operativo, que ya existen) — solo registra el activo como un hecho ya
    conocido (`FixedAsset`: costo, fecha de compra, vida útil en meses, valor residual opcional,
    sucursal) y lleva la depreciación hacia adelante desde ahí. Solo método línea recta, mensual
    completo (sin prorrateo por día); costo/valor residual/vida útil inmutables tras crear (si hay
    error, se da de baja y se crea uno nuevo). Mismo diseño "calcular → contabilizar" en dos pasos
    que el ítem 38 (comisiones): `CalculateDepreciationUseCase` (`POST /depreciation/calculate`)
    calcula la cuota por activo para un período — ajustada en el último período para no pasarse de
    la base depreciable, excluye activos comprados después del período o ya totalmente
    depreciados, nunca sobrescribe una entrada ya `POSTED` al recalcular — y
    `PostDepreciationEntryUseCase` contabiliza una entrada `CALCULATED`
    (`PostDepreciationJournalEntryUseCase`, calco de comisiones: débito "5160 Depreciación",
    crédito "1592 Depreciación acumulada") e incrementa `FixedAsset.accumulatedDepreciation`. Sin
    baja con utilidad/pérdida en venta (fuera de alcance, documentado). Permisos
    `fixed-asset.manage`/`.read` (`SUPERVISOR`/`CONTADOR`, no `CAJERO`). UI en `/fixed-assets`
    (tabs Activos/Depreciación). **Corrección encontrada durante la implementación**: al
    diseñar `DepreciationEntry` como fila hija sin `companyId` propio (protegida vía su
    `FixedAsset` padre, mismo criterio que `SaleItem`/`CommissionSettlement`), el `list()`/
    `findByIdOrThrow()` inicial consultaba la tabla directamente sin filtrar por tenant — a
    diferencia de `SaleItem` (que solo se lee anidado bajo un `Sale` ya scopeado), aquí
    `GET /depreciation/entries` sí consulta la tabla de filas hijas directamente, así que
    necesitaba su propio filtro `fixedAsset: { companyId }` vía join; corregido y verificado en
    vivo con una segunda empresa antes de cerrar el ítem. Los 226 tests previos no se rompieron (8
    nuevos: `calculate-depreciation.use-case.spec.ts`, `post-depreciation-entry.use-case.spec.ts`).
40. ~~Integraciones e-commerce y API pública documentada tipo Zapier~~ — implementado en la
    iteración 40 (2026-08-06). Decisión de alcance confirmada con el usuario: construir la capa
    genérica (API keys, endpoints REST públicos versionados, webhooks salientes configurables) —
    la base que cualquier integrador (Zapier, Make, o un script propio de sync con
    Shopify/WooCommerce/Mercado Libre) necesitaría. **Sin conectores nativos** a esas plataformas
    (requieren credenciales de desarrollador reales de cada una, no disponibles en este entorno —
    mismo tipo de limitación ya documentada para Wompi/DIAN). Módulos nuevos `public-api` y
    `webhooks`. `ApiKey` (hash SHA-256, mostrada en texto plano una sola vez al crearla, `scopes`
    = subconjunto de los permisos de quien la crea) autenticada por `apiKeyAuthMiddleware`, que
    puebla el mismo `tenantStorage`/`AsyncLocalStorage` que usa `tenantContextMiddleware` — así
    `requirePermission()` y todos los repositorios existentes funcionan sin ningún cambio.
    Endpoints `GET/POST /api/public/v1/{products,customers,sales}` reusan directamente los
    casos de uso/repositorios ya existentes (`createSaleUseCase` para pedidos de e-commerce como
    venta real, con factura electrónica DIAN automática igual que desde el POS). Webhooks
    salientes (`WebhookSubscription` + `WebhookDelivery`): único evento en v1 es `sale.created`,
    disparado al final de `CreateSaleUseCase` (try/catch, no bloquea la venta si falla el
    despacho), firmado HMAC-SHA256 (`X-Webhook-Signature`), reenvío manual desde la UI para
    entregas fallidas (sin colas de reintento automático). Gestión restringida a
    `ADMINISTRADOR`/`PROPIETARIO` (`api-key.manage`/`.read`, `webhook.manage`/`.read`, mismo
    criterio que `rbac.manage`). UI en `/integrations` (tabs API Keys / Webhooks).
    **Dos correcciones de aislamiento multi-tenant encontradas durante la implementación**: (1)
    `PrismaWebhookSubscriptionRepository.listActiveForEvent()` inicialmente no filtraba por
    `companyId` — como este método corre dentro de cada venta creada en cualquier empresa, habría
    despachado el webhook `sale.created` de una empresa hacia las suscripciones de **todas** las
    demás; encontrado en revisión de código y corregido antes de ejecutar nada en vivo. (2) bug de
    enrutamiento (no de tenant, pero igual de serio): `publicApiRouter` montaba
    `apiKeyAuthMiddleware`/`publicApiRateLimiter` con `.use()` sin path, lo que interceptaba
    **cualquier** request que llegara a ese router (no solo `/public/v1/*`) — como se monta antes
    que los routers tenant-scoped (mismo motivo que `collectionsWebhookRouter`), esto tumbaba
    silenciosamente `POST /api/api-keys` (y habría tumbado cualquier otra ruta interna montada
    después) con un 401 `INVALID_API_KEY` en vez de dejarla pasar a `tenantContextMiddleware`;
    detectado en la verificación en vivo (`POST /api/api-keys` con JWT válido devolvía
    `INVALID_API_KEY`), corregido escopando el `.use()` al path `/public/v1`
    (`publicApiRouter.use("/public/v1", ...)`, ver `public-api.routes.ts`) y reverificado que las
    ~30 rutas internas JWT-autenticadas volvían a responder normal. Verificado en vivo:
    key válida/sin key/key revocada/key sin el scope requerido, aislamiento multi-tenant de
    ambos catálogos (incluye el caso del punto 1: venta de la empresa A no dispara el webhook de
    la empresa B), firma HMAC verificada manualmente, reenvío manual de entrega fallida. Los 234
    tests previos no se rompieron (7 nuevos: `create-api-key.use-case.spec.ts`,
    `webhook-dispatcher.service.spec.ts`) — 241 en total.
41. ~~WhatsApp para envío de documentos~~ — implementado en la iteración 41 (2026-08-06). Antes de
    este ítem, WhatsApp no enviaba nada y **tampoco ningún documento se enviaba por ningún canal**
    (RIDE de factura y desprendible de nómina se descargaban bajo demanda). Dos partes: (1) envío
    de documentos genuinamente nuevo — el RIDE de la factura al cliente al facturar
    electrónicamente una venta (`CreateSaleUseCase`, tercer `try/catch` no bloqueante tras
    factura/webhook), y el desprendible de nómina al empleado al aprobar el período
    (`ApprovePayrollUseCase`, mismo loop no bloqueante que nómina electrónica); (2) WhatsApp como
    canal alterno con **fallback automático a email** en los dos recordatorios que ya existían
    (vencimiento de suscripción, cobranza) — `SubscriptionReminderLog.channel` ya documentaba
    `"WHATSAPP"` como valor sin usar, el schema anticipaba este ítem. Módulo genérico nuevo
    `whatsapp`: puerto `IWhatsAppSender` + adaptador `WhatsAppCloudApiSender` (Meta Graph API vía
    `fetch`, sin SDK, mismo criterio que `dian-soap-client.ts`) + `WhatsAppDeliveryLog` (a
    diferencia de la mayoría de repos del backend, **todos sus métodos reciben `companyId`
    explícito** en vez de la extensión automática de tenant, porque se escribe tanto desde casos
    de uso tenant-scoped como desde el poller platform-level de recordatorios de suscripción — una
    decisión de diseño deliberada para no repetir la clase de bug de aislamiento de los ítems
    39/40). Envío de documentos = mejor esfuerzo, nunca bloquea la venta/aprobación; si no hay
    teléfono no hay intento (no es un fallo). Reenvío manual sin permisos nuevos (`GET/POST
    .../whatsapp-deliveries` y `.../whatsapp/resend` anidados bajo `electronic-invoicing`/`payroll`,
    reusan `electronic-invoicing.read`/`.manage` y `payroll.read`/`.approve`). Gap real encontrado
    y corregido: `CustomerRecord` no exponía `phone` pese a que `Customer.phone` ya existía en el
    schema desde la iteración 1 — necesario para dos features de este ítem (RIDE por WhatsApp y
    fallback de cobranza). Sigue bloqueado por la misma limitación de siempre (verificación de
    negocio + plantillas pre-aprobadas en Meta, no completable en este entorno — mismo tipo de
    limitación que DIAN/Wompi/Resend); en este entorno el resultado observable es fallo auditado
    para documentos y caída automática a email para recordatorios, cero regresión. UI: badge de
    estado + botón "Reenviar" en `/pos` (tras completar la venta) y `/payroll` (junto al botón
    "Desprendible PDF"). Los 241 tests previos no se rompieron (17 nuevos: 4 de
    `send-invoice-whatsapp.use-case.spec.ts`, 3 de `send-payslip-whatsapp.use-case.spec.ts`, 4 de
    `normalize-phone.spec.ts`, 4 de `run-collections-reminders.use-case.spec.ts` — antes sin
    tests —, 2 nuevos de cascada en `run-subscription-lifecycle.use-case.spec.ts`) — 258 en total.
    Ver `apps/api/src/modules/whatsapp/README.md` para el detalle completo.
42. ~~App móvil completa~~ — implementado en la iteración 42 (2026-08-07). Antes de este ítem solo
    existían 3 pantallas (Login, Dashboard, POS) en un stack plano, sin tabs. Se agregaron **Caja**
    e **Inventario**, cada una con su propia estrategia de cache/offline (no una genérica): la app
    pasó a un tab navigator (`@react-navigation/bottom-tabs`, nuevo) con las 4 pantallas.
    **Caja**: sesión activa cacheada en SQLite (`active_cash_session_cache`, visible aunque esté
    offline con el último dato conocido); abrir/cerrar sesión quedan **online-only** (punto sin
    retorno, mismo criterio que otras acciones financieras de una vía) — lo que sí se encola
    offline son los **movimientos** (`cash_movements_outbox`, mismo patrón exacto que
    `sales_outbox`: intenta la API en vivo primero, si falla encola). Esto obligó a extender el
    motor de sync del backend (ítem 18) más allá de `Sale` por primera vez desde que se construyó:
    `PushSyncEventsUseCase` dejó de estar hardcodeado a `SALE` y pasó a un registro
    `entityType -> {permiso requerido, ejecutor}` (`SALE`/`CASH_MOVEMENT`, reusando
    `RegisterCashMovementUseCase`, el mismo caso de uso de `POST /cash/sessions/:id/movements`).
    **Corrección real encontrada durante este refactor**: `POST /sync/push` se gatea con UN solo
    permiso a nivel de ruta (`sale.create`) para TODO el batch — sin corregirlo, un usuario con
    `sale.create` pero sin `cash.movement.create` habría podido empujar movimientos de caja por
    sync sin que el caso de uso lo note (no valida permisos internamente, confía en el middleware
    REST, que el sync bypassea); se agregó el chequeo de permiso por tipo de entidad dentro del
    caso de uso, verificado con un test dedicado. **Inventario**: solo lectura (CAJERO no tiene
    permisos de ajuste/entrada/traslado de stock, nada que encolar) — nuevo endpoint
    `GET /stock/branch-stock` (antes solo existía `getBranchStock` de un producto a la vez, uso
    interno) cacheado en una tabla SQLite separada del motor de sync genérico (el stock cambia con
    cada venta, meterlo en el pull delta-since existente le habría quitado el sentido). Verificado
    en vivo contra Postgres local: `CASH_MOVEMENT` por sync crea el `CashMovement` real (confirmado
    porque `closingAmountExpected` al cerrar la sesión reflejó correctamente el movimiento),
    reenvío idempotente, conflicto con payload distinto, `GET /stock/branch-stock` aislado por
    tenant. Sin emulador/dispositivo en este entorno: verificado solo con `tsc --noEmit`/`eslint`
    en `apps/mobile`, explícitamente **no probado en runtime móvil** (mismo criterio que el resto
    del trabajo móvil de la iteración 18). Sigue sin NetInfo real (mismo motivo ya documentado:
    intervalo de 30s en su lugar). Los 258 tests previos del backend no se rompieron (2 nuevos en
    `push-sync-events.use-case.spec.ts`) — 260 en total.
43. **POS especializado para restaurantes** (mesas, comandas) — solo aplica si el negocio target
    incluye ese vertical; confirmar con el dueño del producto antes de invertir en esto.
44. ~~Plan único de cuentas (PUC) precargado, con activación por catálogo en vez de creación
    manual~~ — implementado en la iteración 43 (2026-08-20), a pedido directo del usuario
    mientras preparaba el ambiente para que un contador hiciera pruebas: el selector de cuentas
    era un `<select>` plano con todas las cuentas de la empresa, y una empresa nueva arrancaba
    sin ninguna cuenta creada (las ~25 que el motor contable usa automáticamente se creaban solas
    la primera vez que ocurría el hecho económico correspondiente — venta, compra, nómina, etc. —
    nunca antes). Ahora cada empresa arranca con la jerarquía completa de un PUC simplificado
    para pymes de comercio/servicios (clases 1-6, ~90 cuentas — no la codificación oficial
    completa del Decreto 2650, que tiene miles de auxiliares irrelevantes para este alcance): las
    cuentas que el motor ya necesitaba quedan activas desde el registro, el resto queda inactivo
    hasta que el usuario lo activa con un clic desde "Plan de cuentas" — nunca hace falta escribir
    el nombre, solo buscar por código (`AccountCombobox`, cascada por prefijo: escribir "15"
    filtra ese grupo y todas sus cuentas), reemplazando el `<select>` plano en los tres lugares
    donde se elegía una cuenta (cuenta padre, línea de comprobante manual, filtro del libro
    mayor). `ChartOfAccounts.isActive` ya existía en el schema pero no se usaba en ningún lado —
    se agregó el chequeo en `CreateJournalEntryUseCase` (rechaza un comprobante contra una cuenta
    inactiva) y los endpoints `POST /chart-of-accounts/:id/activate`/`.../deactivate`. Ver
    `apps/api/src/modules/accounting/README.md` punto 11 para el detalle completo, incluida una
    tensión pre-existente de nombres en el código `5135` que este ítem no causó pero sí tuvo que
    resolver (gana "Comisiones", el que ya estaba activo de antemano). **Mismo día, a pedido del
    usuario**: la cuenta base (clase/grupo/cuenta) ahora deja de admitir movimientos directos en
    cuanto se le crea una subcuenta/auxiliar propia — convención PUC real. Acotado a cuentas
    creadas a mano: las ~20 cuentas de 4 dígitos que el motor contable ya usa automáticamente
    quedan exentas (decidido con el usuario para no reescribir los 9 `Post*JournalEntryUseCase`
    ya verificados). **También a pedido del usuario**: solo subcuentas/auxiliares (nivel > 3) se
    pueden renombrar (`PATCH /chart-of-accounts/:id`) — las cuentas principales (clase/grupo/
    cuenta) quedan fijas, sin botón de editar. **También a pedido del usuario**: el Balance
    General gana toggles "Mostrar código" (solo UI) y "Con terceros" — este último desglosa
    `1305 Clientes`/`2205 Proveedores` en una fila por cliente/proveedor (las únicas dos cuentas
    con un tercero identificable de punta a punta en el schema); el resto del catálogo no cambia.
    Ver `apps/api/src/modules/accounting/README.md` punto 11 para el detalle.
45. **IA (categorización automática, asistente conversacional, insights)** — gancho de marketing
    de Alegra/Siigo en 2026. Prioridad deliberadamente más baja: no es funcionalidad ERP core, es
    percepción de producto — revisar solo después de cerrar el 29-39.
