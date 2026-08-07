# Manual de funcionamiento — Contapro

*ERP para tiendas, minimercados, papelerías, ferreterías, boutiques y droguerías en Colombia*

Este manual explica **cómo usar Contapro en el día a día del negocio**, sin lenguaje técnico. Está
organizado por tareas: busca la sección del módulo que necesitas y sigue los pasos. Cada sección
indica qué rol de usuario suele encargarse de esa tarea (Cajero, Supervisor, Contador,
Administrador/Propietario), aunque un Administrador puede hacer todo.

> Para el detalle técnico de arquitectura o para desarrolladores, ver `docs/ARQUITECTURA.md` en el
> repositorio. Este manual es solo para el uso funcional del sistema.

## Índice

1. [Primeros pasos](#1-primeros-pasos)
2. [Panel principal](#2-panel-principal)
3. [Inventario](#3-inventario)
4. [Punto de venta (POS)](#4-punto-de-venta-pos)
5. [Caja](#5-caja)
6. [Clientes y cobranza](#6-clientes-y-cobranza)
7. [Oportunidades de venta (CRM)](#7-oportunidades-de-venta-crm)
8. [Facturación electrónica DIAN](#8-facturación-electrónica-dian)
9. [Proveedores y compras](#9-proveedores-y-compras)
10. [Gastos operativos](#10-gastos-operativos)
11. [Contabilidad](#11-contabilidad)
12. [Nómina](#12-nómina)
13. [Comisiones de vendedores](#13-comisiones-de-vendedores)
14. [Activos fijos](#14-activos-fijos)
15. [Facturación recurrente](#15-facturación-recurrente)
16. [Información exógena DIAN](#16-información-exógena-dian)
17. [Ventas en otras monedas](#17-ventas-en-otras-monedas)
18. [Integraciones (API, webhooks, WhatsApp)](#18-integraciones-api-webhooks-whatsapp)
19. [App móvil](#19-app-móvil)
20. [Panel administrador (suscripción de tu empresa)](#20-panel-administrador-suscripción-de-tu-empresa)
21. [Roles y permisos](#21-roles-y-permisos)
22. [Preguntas frecuentes](#22-preguntas-frecuentes)
23. [Glosario](#23-glosario)

---

## 1. Primeros pasos

### Crear tu empresa

1. Entra a la pantalla de registro y completa el nombre de la empresa, NIT y los datos del primer
   usuario (quedará como Administrador).
2. Al registrarte, tu empresa queda automáticamente en un **plan de prueba gratuito de 30 días**
   con todos los módulos habilitados — no necesitas tarjeta para empezar.
3. El sistema crea tu primera sucursal automáticamente. Puedes agregar más sucursales después
   desde Configuración si tu negocio tiene varios puntos de venta.

### Iniciar sesión

- Ingresa con el correo y contraseña que registraste.
- Si olvidaste tu contraseña, usa el enlace "¿Olvidaste tu contraseña?" en la pantalla de login:
  te llega un correo con un link para crear una nueva.
- La sesión se cierra sola por seguridad después de un tiempo inactivo; el sistema la renueva
  automáticamente mientras estés trabajando.

### Usuarios y roles

Desde **Configuración → Usuarios**, un Administrador puede:

- Crear usuarios nuevos y asignarles un rol (ver [sección 21](#21-roles-y-permisos)).
- Cambiar el rol o desactivar un usuario que ya no trabaja en el negocio.
- Dar permisos individuales adicionales a un usuario puntual, sin cambiarle el rol completo.

---

## 2. Panel principal

Al entrar ves un resumen del día:

- **Ventas del día** — total vendido y número de tickets.
- **Productos más vendidos** — top del período.
- **Stock bajo** — productos que están por debajo de su mínimo configurado, para reponer a
  tiempo.
- **Caja activa** — si hay una caja abierta en tu sucursal y quién la abrió.

---

## 3. Inventario

*(Rol típico: Administrador, Supervisor. Cajero solo puede consultar, no editar precio/costo.)*

### Productos

- Crea productos con nombre, categoría, marca, código de barras, precio de venta y costo.
- Un producto puede tener **presentaciones** (ej. una caja de 12 unidades) y **código de
  barras** propio por presentación.
- Un producto puede rastrear **lotes** (fechas/cantidades de entrada) si quieres que el sistema
  calcule el costo por el método **FIFO** (primero en entrar, primero en salir) en vez de costo
  promedio.
- Por seguridad, un Cajero **no puede** cambiar precio, costo, código de barras, ni eliminar
  productos — solo verlos y venderlos.

### Stock por sucursal

- El stock se controla por sucursal (no es un solo número global si tienes varias tiendas).
- Configura un **mínimo y máximo** por producto/sucursal para que el Dashboard te avise cuando
  hace falta reponer.
- Los movimientos de stock (entradas manuales, ajustes, traslados entre sucursales) quedan
  registrados con quién los hizo y cuándo — es el historial de auditoría del inventario.

### Kardex

- **Inventario → Kardex** muestra el historial completo de un producto: cada entrada, salida,
  ajuste y venta, con el saldo de cantidad y costo después de cada movimiento. Útil para
  reconstruir "qué pasó" con un producto específico.

### Listas de precios

- Puedes crear varias **listas de precios** (ej. "Mayorista", "Minorista") y asignarle precios
  distintos a un mismo producto en cada lista.
- Asigna una lista de precios a un cliente específico (en su ficha de Cliente) para que el POS
  use automáticamente ese precio cuando le vendes a él, o elige la lista manualmente al momento
  de la venta.

---

## 4. Punto de venta (POS)

*(Rol típico: Cajero, con caja abierta.)*

### Vender

1. Abre **POS**. El cuadro "Buscar por nombre o escanear código de barras" queda enfocado
   automáticamente al entrar a la pantalla.
2. Para agregar con el **lector de código de barras**: solo tiene que estar conectado (USB o
   Bluetooth) — no requiere configuración adicional. El lector "escribe" el código en ese cuadro
   y termina con Enter; si el código coincide exactamente con un producto, se agrega solo al
   carrito y el cuadro queda limpio, listo para escanear el siguiente.
3. También puedes buscar **escribiendo el nombre** (o parte de él): la lista de abajo se filtra
   en el momento. Si al presionar Enter queda un solo producto visible, también se agrega solo.
   Si hay varias coincidencias, elige haciendo clic en el que corresponda — así se evita agregar
   el producto equivocado por error.
4. Si el cliente tiene una lista de precios asignada, el precio se ajusta solo.
5. Elige el medio de pago: efectivo, transferencia, tarjeta, o **crédito** (queda como cuenta por
   cobrar, ver [sección 6](#6-clientes-y-cobranza)).
6. Confirma la venta. El sistema descuenta el stock, contabiliza la venta automáticamente y
   genera la factura electrónica (ver [sección 8](#8-facturación-electrónica-dian)).

### Descuentos con autorización

- Cada Cajero tiene un **límite de descuento** configurado (ej. 5%). Si intenta dar más
  descuento, la venta queda **pendiente de autorización** hasta que un Supervisor la apruebe con
  su PIN o contraseña.

### Cotizaciones y notas crédito/débito

- **Cotizaciones**: genera un presupuesto para el cliente sin afectar inventario ni caja; se
  puede convertir en venta después.
- **Notas crédito/débito**: ajustan una factura ya emitida (ej. un descuento posterior o un cobro
  adicional), en **Cotizaciones y notas**.

### Devoluciones

En **Cotizaciones y notas → Devoluciones**:

1. Busca la venta original (debe estar completada).
2. Marca qué productos y cantidades devuelve el cliente.
3. Si el producto viene dañado, marca "no repone stock" para que no vuelva a quedar disponible
   para la venta.
4. Elige cómo se reembolsa (efectivo, transferencia, o a favor en la cuenta del cliente). El
   sistema ajusta el inventario y contabiliza el reverso automáticamente.

---

## 5. Caja

*(Rol típico: Cajero, Supervisor.)*

- **Abrir caja** al iniciar el turno, indicando el efectivo inicial.
- Todo pago en efectivo del POS queda asociado a esa caja.
- Registra **movimientos manuales** (retiros, consignaciones al banco, ingresos/egresos que no
  son ventas).
- **Cerrar caja** al final del turno: cuenta el efectivo físico por denominación (arqueo) y el
  sistema calcula la diferencia contra lo que debería haber según el sistema. Si sobra o falta
  dinero, queda contabilizado automáticamente.

---

## 6. Clientes y cobranza

*(Rol típico: Cajero para registrar clientes, Contador/Supervisor para cobranza.)*

- Registra clientes con sus datos (nombre/razón social, documento, contacto).
- Una venta con medio de pago **"Crédito"** genera automáticamente una **cuenta por cobrar** con
  vencimiento a 30 días.
- En **Cobranza**, puedes:
  - Registrar un abono en persona (efectivo, transferencia).
  - Generar un **link de pago en línea** (Wompi) para que el cliente pague desde su celular o
    computador.
  - El sistema envía **recordatorios automáticos por correo** antes y después del vencimiento.

---

## 7. Oportunidades de venta (CRM)

*(Rol típico: Supervisor, vendedores.)*

- El tablero **CRM** organiza negociaciones en etapas: Prospecto → Contacto → Propuesta →
  Negociación → Ganada/Perdida.
- Al mover una oportunidad a **"Ganada"**, el sistema genera la venta automáticamente (a
  crédito) sin que tengas que volver a capturar los productos.
- Si se pierde, debes indicar el motivo — queda registrado para análisis posterior.

---

## 8. Facturación electrónica DIAN

*(Automático — no requiere pasos manuales del usuario en la venta normal.)*

- Cada venta completada, nota crédito/débito, compra a proveedor no obligado a facturar, y cada
  nómina aprobada genera automáticamente su **documento electrónico** (CUFE/CUDE según el tipo)
  y se envía a la DIAN.
- Puedes descargar el **RIDE** (representación en PDF de la factura) desde el detalle de la
  venta.
- **Importante**: el envío real a los servidores de la DIAN requiere que tu empresa tenga
  credenciales de habilitación DIAN configuradas por un Administrador en Configuración. Sin esas
  credenciales, el documento se genera pero no se transmite.

---

## 9. Proveedores y compras

*(Rol típico: Administrador, Contador, Supervisor de compras.)*

### Flujo con orden de compra

1. Crea el **proveedor** con sus datos.
2. Crea una **orden de compra** con los productos y cantidades a pedir.
3. Márcala como **enviada** cuando se la mandas al proveedor.
4. Cuando llega la mercancía, registra la **recepción** (parcial o total) — esto sí actualiza el
   stock e impacta el costo promedio del producto.

### Registro directo de factura

- Si no necesitas el paso de orden de compra, puedes registrar la **factura de compra**
  directamente, con impacto inmediato en inventario y en cuentas por pagar.

### Abonos y cancelación

- Registra **abonos** a la cuenta por pagar del proveedor a medida que le vas pagando.
- Si necesitas **cancelar una compra** que ya tiene abonos registrados, el sistema los reversa
  automáticamente antes de anular la compra — no hace falta reversarlos a mano primero.

---

## 10. Gastos operativos

*(Rol típico: Administrador, Contador.)*

- Para gastos que no son compra de mercancía (arriendo, servicios públicos, reembolsos), usa
  **Gastos** en vez de Proveedores/Compras.
- Elige una categoría de gasto (o crea una nueva), el beneficiario y el valor. Se contabiliza
  automáticamente al registrarlo.
- Los gastos se pagan completos al momento de registrarlos (no generan cuentas por pagar).

---

## 11. Contabilidad

*(Rol típico: Contador, Administrador.)*

La mayoría de los comprobantes contables **se generan solos** cuando ocurre la operación de
negocio (venta, compra, nómina aprobada, abono a proveedor, cierre de caja con diferencia). No
necesitas contabilizar manualmente el día a día — este módulo es para configurar, revisar y
cerrar.

- **Plan de cuentas**: catálogo de cuentas contables de tu empresa, editable.
- **Comprobantes manuales**: para asientos que no vienen de otro módulo. El sistema valida que
  siempre cuadre débito = crédito antes de dejarte postear.
- **Libro mayor, Balance General, Estado de Resultados**: reportes estándar, filtrables por
  sucursal y por centro de costo.
- **Centros de costo**: etiqueta comprobantes manuales y gastos por área del negocio (ej. "Sede
  Norte", "Administración") para verlos separados en los reportes.
- **Retenciones**: configura los conceptos de retención en la fuente/ICA/IVA que aplican a tus
  ventas y compras; el sistema los calcula solo.
- **Bancos y conciliación**: registra tus cuentas bancarias y los movimientos del extracto. El
  sistema te **sugiere** qué movimiento del banco corresponde a qué comprobante (por monto y
  fecha cercana) — tú confirmas cada coincidencia.
- **Cierre de período**: al cerrar un mes, el sistema bloquea que se creen o modifiquen
  comprobantes con fecha dentro de ese mes (protege la información ya reportada). Puedes
  reabrirlo si necesitas corregir algo.

---

## 12. Nómina

*(Rol típico: Administrador, Contador de nómina.)*

### Antes de liquidar

- Registra tus **empleados** (cédula, salario, fecha de ingreso).
- El sistema lleva **control de horarios**: marcación de entrada/salida, horas extra y recargos
  nocturnos/dominicales/festivos calculados automáticamente (incluye el calendario oficial de
  festivos colombianos).
- Gestiona **vacaciones, permisos e incapacidades** con flujo de aprobación (el empleado o su
  jefe solicita, un Supervisor aprueba o rechaza).
- Si un empleado tiene una **libranza o embargo**, regístralo en Deducciones recurrentes con la
  cuota fija por período — se descuenta solo en cada nómina hasta agotar el saldo (o
  indefinidamente si no tiene saldo definido).

### Liquidar un período

1. Crea el período de nómina (quincena o mes, según tu configuración).
2. **Calcular**: el sistema liquida salario, auxilio de transporte, horas extra, deducciones de
   ley y deducciones recurrentes. Puedes recalcular las veces que necesites mientras esté en
   borrador.
3. **Aprobar**: genera el comprobante contable y descuenta el saldo de las deducciones — este
   paso ya no se puede deshacer, así que revisa antes de aprobar.
4. **Pagar**: marca el período como pagado.
5. Descarga el **desprendible en PDF** de cada empleado desde el detalle del período.

---

## 13. Comisiones de vendedores

*(Rol típico: Supervisor, Contador.)*

- Configura un **porcentaje de comisión** por vendedor.
- Al final del mes, **liquida las comisiones**: el sistema calcula sobre el total vendido por
  cada vendedor en el período.
- Al marcarla como pagada, se contabiliza automáticamente.

---

## 14. Activos fijos

*(Rol típico: Contador.)*

- Registra los activos de la empresa (equipos, muebles, vehículos) con su costo, fecha de compra
  y vida útil.
- Cada mes, **calcula la depreciación** (línea recta) y luego **contabilízala** — son dos pasos
  separados para que puedas revisar el cálculo antes de contabilizar.

---

## 15. Facturación recurrente

*(Rol típico: Supervisor, Contador — no disponible para Cajero.)*

- Crea una **plantilla de factura recurrente** para clientes que te pagan lo mismo todos los
  meses (ej. una cuota de arriendo que tú facturas, un servicio mensual).
- Define el día del mes en que se debe facturar. El sistema genera la venta automáticamente ese
  día, con su factura electrónica incluida.
- Revisa el historial de ejecuciones para confirmar que cada corrida generó la venta
  correctamente.

---

## 16. Información exógena DIAN

*(Rol típico: Contador, una vez al año.)*

- En **Contabilidad → Exógena**, genera los formatos que exige la DIAN sobre pagos/retenciones a
  proveedores y ventas a clientes, listos para revisar antes de presentarlos.
- Genera el archivo en el formato plano que pide la DIAN o una vista previa en pantalla.

---

## 17. Ventas en otras monedas

- En el POS o en el formulario de compra, puedes elegir una moneda distinta a pesos colombianos
  e indicar la tasa de cambio del día.
- Esto es **informativo**: el valor en pesos sigue siendo el que se contabiliza y el que se
  reporta a la DIAN (la ley exige el comprobante en COP). El total en la otra moneda solo se
  muestra como referencia.

---

## 18. Integraciones (API, webhooks, WhatsApp)

*(Rol típico: Administrador/Propietario — configuración técnica puntual.)*

- **API pública**: si usas otro sistema (una tienda en línea, por ejemplo) y quieres conectarlo a
  Contapro, genera una **llave de API** en Configuración → Integraciones, con los permisos que
  necesite.
- **Webhooks**: Contapro puede avisarle a otro sistema en tiempo real cuando se registra una
  venta.
- **WhatsApp**: si está configurado, el sistema envía automáticamente la factura o el desprendible
  de nómina por WhatsApp al cliente/empleado, además del correo.

---

## 19. App móvil

- La app móvil (Android/iOS vía Expo) permite vender desde el celular con el mismo catálogo, y
  **funciona sin conexión**: guarda las ventas localmente y las sincroniza apenas hay señal.
- También permite abrir/cerrar caja y consultar inventario desde el celular.
- Usa "Sincronizar" manualmente si quieres forzar el envío de lo pendiente antes de que pase el
  intervalo automático.

---

## 20. Panel administrador (suscripción de tu empresa)

*(Rol típico: Administrador/Propietario.)*

- En **Mi suscripción** (`/billing`) ves tu plan actual, fecha de vencimiento y puedes cambiar de
  plan o pagar en línea.
- Si tu suscripción vence, el sistema te avisa por correo antes del vencimiento (8, 5, 3, 1 y 0
  días antes) y da un período de gracia antes de suspender el acceso.

---

## 21. Roles y permisos

| Rol | Para qué sirve |
|---|---|
| **Propietario / Administrador** | Acceso total: configuración, todos los módulos, usuarios y permisos |
| **Contador** | Contabilidad, nómina, proveedores, reportes — normalmente sin POS |
| **Supervisor** | Aprueba descuentos, devoluciones, vacaciones/permisos; acceso amplio a operación |
| **Cajero** | Solo POS y caja; no puede cambiar precios/costos ni eliminar productos |
| **Empleado** | Acceso mínimo: su propio perfil, marcación, solicitudes de vacaciones/permisos |

Un Administrador puede afinar esto dándole o quitándole **permisos individuales** a un usuario
puntual sin cambiar su rol completo, desde Configuración → Usuarios.

---

## 22. Preguntas frecuentes

**¿Por qué un Cajero no puede cambiar el precio de un producto?**
Es una protección deliberada: solo roles con más confianza (Supervisor, Administrador) pueden
tocar precio, costo o código de barras. Si un Cajero necesita un descuento puntual, se hace desde
el POS con autorización, no editando el producto.

**Di clic en "Aprobar" en Nómina por error, ¿puedo deshacerlo?**
No. Aprobar un período de nómina (igual que contabilizar o aprobar una compra) es un paso sin
retorno porque ya generó comprobantes contables y descontó saldos de deducciones. Verifica el
cálculo antes de aprobar.

**¿Qué pasa si cierro un período contable por error?**
Puedes **reabrirlo** desde Contabilidad → Cierre de período, mientras no hayas empezado el
siguiente cierre.

**¿Los recordatorios de cobranza/suscripción se envían solos?**
Sí, corren automáticamente por correo (y WhatsApp si está configurado). No necesitas enviarlos a
mano.

**Vendí con la moneda equivocada, ¿afecta la contabilidad?**
No — el valor contable y el que se reporta a la DIAN siempre es en pesos colombianos; la otra
moneda es solo de referencia visual.

---

## 23. Glosario

- **CUFE / CUDE / CUDS / CUNE**: código único que identifica una factura/nota/documento
  electrónico ante la DIAN.
- **RIDE**: representación gráfica en PDF de un documento electrónico DIAN (lo que le entregas al
  cliente impreso o por correo).
- **FIFO**: método de costeo "primero en entrar, primero en salir" — el sistema descuenta primero
  el lote más antiguo del producto.
- **Kardex**: historial detallado de movimientos y saldos de un producto.
- **Cuenta por cobrar/pagar**: dinero que un cliente te debe (cobrar) o que le debes a un
  proveedor (pagar).
- **Comprobante contable**: registro formal de una transacción en la contabilidad (débito y
  crédito balanceados).
- **RBAC**: sistema de roles y permisos que controla quién puede ver o hacer qué en Contapro.
