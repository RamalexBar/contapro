// Contenido del manual de uso de Contapro (menu lateral, en el mismo orden). Lo usa
// build-user-manual.ts para generar apps/web/public/manual-contapro.pdf. Si cambia una pantalla,
// se actualiza aqui y se vuelve a generar el PDF.

export interface StepGroup {
  title: string;
  steps: string[];
}

export interface ManualSection {
  /** Seccion del menu lateral (ej. "Ventas"). */
  group: string;
  /** Opcion del menu tal como aparece (ej. "Punto de venta"). */
  title: string;
  /** Para que sirve, en una o dos frases. */
  intro: string;
  how: StepGroup[];
  /** Que queda registrado en contabilidad, si aplica. */
  accounting?: string[];
  tips?: string[];
}

export const MANUAL_INTRO = [
  "Este manual explica cada opción del menú de Contapro, en el mismo orden en que aparecen a la izquierda de la pantalla. Cada capítulo dice para qué sirve la opción, cómo se usa paso a paso y qué queda registrado en la contabilidad.",
  "No todos los usuarios ven todas las opciones: el menú muestra solo lo que el rol de cada usuario tiene permitido (por ejemplo, un cajero ve Punto de venta y Caja, pero no Contabilidad). Los roles se configuran en Configuración → Roles y permisos.",
  "En Contapro casi todo se contabiliza solo: cada venta, compra, gasto, cobro, pago y cierre de caja genera su comprobante contable automáticamente. El capítulo \"Cómo revisar que todo quedó bien contabilizado\", al final, explica cómo comprobarlo.",
];

export const FIRST_STEPS: StepGroup[] = [
  {
    title: "Ingresar",
    steps: [
      "Entra a contapro.com.co y pulsa \"Ingresar\".",
      "Escribe tu correo y tu contraseña. Si tu correo está en varias empresas (por ejemplo, si eres contador de varios clientes), Contapro te pregunta a cuál quieres entrar.",
      "Si olvidaste la contraseña, pulsa \"¿Olvidaste tu contraseña?\" y sigue el enlace que llega a tu correo.",
    ],
  },
  {
    title: "Antes de empezar a vender (orden recomendado)",
    steps: [
      "Configuración → Datos de la empresa: completa razón social, NIT, dirección y responsabilidades tributarias.",
      "Configuración → Roles y permisos: crea los usuarios de tus empleados (cajeros, vendedores) con su rol.",
      "Inventario: crea tus productos o impórtalos desde Excel.",
      "Compras → Registrar compra: registra la mercancía que tienes o que vas comprando; así el inventario entra con su costo.",
      "Ventas → Caja: abre la caja con el dinero inicial.",
      "Ventas → Punto de venta: ¡ya puedes vender!",
    ],
  },
  {
    title: "Sucursales",
    steps: [
      "Si tu empresa tiene varias sucursales, en la barra de arriba aparece la sucursal en la que estás. Cámbiala desde ahí: las ventas, la caja y el inventario que veas son los de esa sucursal.",
    ],
  },
];

export const SECTIONS: ManualSection[] = [
  // ---------------------------------------------------------------- PRINCIPAL
  {
    group: "Principal",
    title: "Dashboard",
    intro: "Es la pantalla de inicio. Muestra de un vistazo cómo va el negocio.",
    how: [
      {
        title: "Qué muestra",
        steps: [
          "Ventas de hoy y ventas del mes.",
          "Utilidad estimada del mes.",
          "Caja activa: si hay una caja abierta y cuánto tiene.",
          "Productos agotados, facturas pendientes y clientes nuevos del mes.",
          "Productos más vendidos.",
          "Avisos: por ejemplo, solicitudes de vacaciones o permisos por revisar (si eres administrador) o la respuesta a tus solicitudes (si eres empleado). Pulsa \"Entendido\" para ocultarlas.",
        ],
      },
    ],
    tips: ["Si la suscripción está por vencer, arriba aparece una franja con el enlace \"Renovar ahora\"."],
  },

  // ---------------------------------------------------------------- VENTAS
  {
    group: "Ventas",
    title: "Punto de venta",
    intro: "Aquí se registran las ventas del almacén. Cada venta descuenta el inventario, entra a la caja o a cartera y queda contabilizada sola.",
    how: [
      {
        title: "Hacer una venta",
        steps: [
          "Verifica que haya una caja abierta (Ventas → Caja). Si no la hay, aparece el aviso \"No hay una caja abierta\".",
          "En \"Buscar por nombre o escanear código de barras\" escribe el producto o pasa el lector de código de barras. Pulsa el producto para agregarlo al carrito.",
          "En el carrito ajusta la cantidad. Si das un descuento, escríbelo en \"% descuento\". Si el descuento supera lo que tu rol permite, se pide la autorización de un supervisor (con su PIN).",
          "Si la venta es para un cliente registrado, elígelo. Si no, la venta queda a \"Consumidor final\".",
          "Elige el pago: Efectivo, Transferencia o A crédito.",
          "Si es en efectivo, escribe en \"Recibido\" cuánto te entregó el cliente: Contapro muestra el vuelto (cuánto devolver). Si paga exacto, deja el campo vacío.",
          "Si es a crédito, elige el cliente (es obligatorio) y el plazo en días.",
          "Confirma la venta. Pulsa \"Imprimir tirilla\" para entregarle el comprobante al cliente.",
        ],
      },
      {
        title: "Opciones adicionales",
        steps: [
          "Lista de precios: si el cliente tiene una lista (mayorista, VIP), los precios cambian solos al elegirlo.",
          "Retenciones: si el cliente es una empresa que te practica retención, pulsa \"+ agregar retención\", elige el concepto y la base. El cliente paga el neto.",
          "Moneda: puedes registrar una venta en USD o EUR escribiendo la TRM del día.",
        ],
      },
    ],
    accounting: [
      "Comprobante \"Venta #número\": entra el dinero a Caja (efectivo), a Bancos (transferencia) o a Clientes (a crédito); se registra el ingreso por ventas y el IVA generado; y se registra el costo de venta y la salida del inventario.",
      "Si fue a crédito, la venta aparece también en Cobranza → Cuentas por cobrar.",
    ],
    tips: [
      "El punto de venta ofrece Efectivo, Transferencia y A crédito. Los pagos con datáfono regístralos como Transferencia, porque el dinero llega al banco.",
    ],
  },
  {
    group: "Ventas",
    title: "Cotizaciones",
    intro: "Reúne cotizaciones, notas crédito, notas débito y devoluciones de ventas.",
    how: [
      {
        title: "Crear una cotización",
        steps: [
          "Pestaña Cotizaciones: elige el cliente (opcional) y la fecha \"Válida hasta\".",
          "Agrega los productos y cantidades y pulsa \"Crear cotización\".",
          "Pulsa \"Imprimir\" para enviarla o entregarla al cliente. Una cotización no mueve inventario ni contabilidad.",
        ],
      },
      {
        title: "Registrar una devolución",
        steps: [
          "Pestaña Devoluciones: en \"Seleccionar venta...\" elige la venta original.",
          "En cada producto escribe la \"Cantidad a devolver\" (no puede superar lo vendido menos lo ya devuelto).",
          "Marca \"Reponer a inventario\" si el producto vuelve al almacén en buen estado.",
          "Elige el \"Medio de reembolso\": Efectivo, Tarjeta, Transferencia o Abono a cuenta del cliente.",
          "Pulsa \"Registrar devolución\".",
        ],
      },
      {
        title: "Notas crédito y débito",
        steps: [
          "Pestañas Notas crédito / Notas débito: elige el cliente, la venta (opcional), escribe el motivo y el monto, y pulsa \"Emitir\".",
          "Úsalas para corregir el valor de una venta ya hecha (crédito: disminuye; débito: aumenta).",
        ],
      },
    ],
    accounting: ["Cada devolución genera el comprobante \"Devolución de venta\" (reversa el ingreso, el IVA y, si repones, el inventario)."],
  },
  {
    group: "Ventas",
    title: "Caja",
    intro: "Controla el efectivo del almacén por turnos: quién abrió la caja, con cuánto, cuánto debería haber y cuánto se contó al cerrar.",
    how: [
      {
        title: "Abrir la caja",
        steps: [
          "Escribe el \"Dinero inicial\" (la base con la que empiezas) y pulsa \"Abrir caja\".",
          "La caja queda a tu nombre (\"Abierta por\"). Si otro usuario la abrió, Contapro te lo avisa.",
        ],
      },
      {
        title: "Cerrar la caja (arqueo)",
        steps: [
          "Cuenta el efectivo y escríbelo en \"Dinero contado al cierre\". Contapro muestra cuánto \"Debería haber en caja\".",
          "Si hay diferencia, Contapro te avisa si es faltante o sobrante y te deja \"Revisar conteo\" antes de confirmar.",
          "Pulsa \"Cerrar caja (arqueo)\".",
          "Abajo, en \"Turnos de esta caja\", ves el historial: quién abrió, quién cerró, base, esperado, contado y diferencia.",
        ],
      },
    ],
    accounting: ["Si al cerrar hay diferencia, se genera el comprobante \"Faltante de caja en arqueo\" o \"Sobrante de caja en arqueo\". Si cuadra exacto, no se genera ningún comprobante adicional."],
  },
  {
    group: "Ventas",
    title: "Factura electrónica",
    intro: "Crea una factura electrónica con líneas de descripción libre, sin pasar por el punto de venta ni por el inventario. Sirve para servicios (por ejemplo, asesorías).",
    how: [
      {
        title: "Crear una factura",
        steps: [
          "Antes, completa los datos fiscales en Configuración → Datos de la empresa.",
          "Elige la sucursal y el cliente (o deja \"Consumidor final\").",
          "En cada línea escribe la descripción, la cantidad, el valor unitario y el IVA %. Usa \"Agregar línea\" para más renglones.",
          "Pulsa \"Crear factura\" y luego \"Ver PDF\" para descargarla.",
        ],
      },
    ],
    tips: ["Para que la factura llegue a la DIAN, tu empresa debe tener activa la facturación electrónica (Otros → Integraciones → Facturación electrónica). El equipo de Contapro te acompaña en esa activación."],
  },

  // ---------------------------------------------------------------- INVENTARIO
  {
    group: "Inventario",
    title: "Inventario",
    intro: "Aquí está el catálogo de productos y todo el control de existencias: categorías, marcas, listas de precios, sucursales, entradas, ajustes y kardex.",
    how: [
      {
        title: "Crear un producto",
        steps: [
          "En \"Nuevo producto\" escribe la referencia (SKU), el nombre, el precio de venta (sin IVA), el costo y la categoría y marca.",
          "Si tiene código de barras, escríbelo o léelo con el lector (puedes agregar varios con \"+ código\").",
          "Pulsa \"Crear\". El producto empieza sin existencias: las existencias entran con las compras.",
          "Para cambiar precio o costo usa \"Editar\". Para dejar de venderlo, \"Desactivar\".",
        ],
      },
      {
        title: "Importar productos desde Excel",
        steps: [
          "Pulsa \"Importar\" en \"Importar productos desde Excel\". Puedes usar la plantilla de Contapro o una exportación de Alegra o Siigo.",
          "Revisa que cada dato quede en la columna correcta y pulsa \"Revisar archivo\". No se guarda nada hasta que no haya errores; si los hay, se listan por fila.",
          "Si los precios del archivo ya incluyen IVA, marca esa opción (Contapro guarda el precio antes de IVA).",
        ],
      },
      {
        title: "Listas de precios",
        steps: [
          "Crea una lista (ej. Mayorista) y en \"Precios por producto\" pon el precio de cada producto en esa lista.",
          "Asigna la lista al cliente en Clientes. En el punto de venta, al elegir ese cliente, se cobra el precio de su lista. Si un producto no tiene precio en la lista, se cobra el precio base.",
        ],
      },
      {
        title: "Sucursales y traslados",
        steps: [
          "En \"Sucursales\" crea, edita o desactiva sucursales.",
          "En \"Stock por sucursal\" elige una sucursal para ver sus existencias.",
          "En \"Trasladar stock entre sucursales\" elige el producto, la sucursal de origen, la de destino y la cantidad, y pulsa \"Trasladar\".",
        ],
      },
      {
        title: "Entradas y ajustes de inventario",
        steps: [
          "\"Entrada manual de stock\": para sumar existencias que no vienen de una compra a un proveedor (inventario inicial que faltaba, producción propia). Indica cantidad y costo unitario.",
          "\"Ajuste de stock\": para corregir por pérdida, daño o un conteo físico distinto. Usa un número negativo para restar y escribe el motivo.",
        ],
      },
      {
        title: "Kardex",
        steps: [
          "En \"Kardex\" elige un producto (y si quieres, una sucursal y un rango de fechas).",
          "Ves cada movimiento (compra, venta, devolución, traslado, ajuste) con la cantidad, el saldo y el costo promedio después de cada movimiento.",
        ],
      },
    ],
    accounting: ["El inventario se valora a costo promedio. Las compras lo aumentan (cuenta 1435 Inventarios) y las ventas lo disminuyen contra el costo de ventas (cuenta 6135)."],
  },

  // ---------------------------------------------------------------- CONTABILIDAD
  {
    group: "Contabilidad",
    title: "Contabilidad",
    intro: "Es el centro contable. Tiene seis pestañas: Plan de cuentas, Comprobantes, Reportes, Cierre de período, Retenciones y Centros de costo.",
    how: [
      {
        title: "Plan de cuentas",
        steps: [
          "Contapro trae el PUC listo. Busca una cuenta por código o nombre.",
          "Con \"Nueva cuenta\" creas subcuentas (código, nombre, cuenta padre y tipo). Con \"Habilitar movimientos\" una cuenta puede recibir registros.",
          "Si tu contador ya tiene su plan de cuentas, usa \"Importar plan de cuentas desde Excel\".",
        ],
      },
      {
        title: "Comprobantes",
        steps: [
          "Aquí están todos los comprobantes: los automáticos (ventas, compras, gastos, caja, nómina...) y los manuales.",
          "Para un comprobante manual (ajustes, notas contables): pulsa \"Nuevo comprobante manual\", escribe la descripción y la fecha, y agrega las líneas con cuenta, débito y crédito (\"+ Línea\"). Débitos y créditos deben sumar igual.",
          "El comprobante queda en borrador hasta que pulses \"Confirmar comprobante\". Si te equivocaste, usa \"Anular comprobante\" (no se borra: queda anulado y visible).",
          "Con \"Imprimir\" sacas el comprobante en PDF.",
        ],
      },
      {
        title: "Reportes",
        steps: [
          "Balance General (a una fecha de corte), Estado de Resultados (entre dos fechas), Flujo de caja y Libro mayor (movimientos y saldo de una cuenta).",
          "Puedes filtrar por sucursal y por centro de costo, y ver el detalle por tercero (cliente o proveedor).",
          "Todos se pueden imprimir.",
        ],
      },
      {
        title: "Cierre de período",
        steps: [
          "Elige año y mes y pulsa \"Cerrar período\". Después del cierre no se pueden registrar ni modificar movimientos en ese mes.",
          "Si necesitas corregir algo, el historial de períodos tiene \"Reabrir\".",
        ],
      },
      {
        title: "Retenciones y centros de costo",
        steps: [
          "Retenciones: crea los conceptos (retención en la fuente, ReteICA, ReteIVA) con su tarifa y el código DIAN (para la exógena). Se usan en ventas y compras.",
          "Centros de costo: etiqueta gastos y comprobantes por área o proyecto, para filtrar el Estado de Resultados y el Libro mayor.",
        ],
      },
    ],
  },
  {
    group: "Contabilidad",
    title: "Libro Diario",
    intro: "Muestra todos los comprobantes contables en orden de fecha, con el detalle de las cuentas debitadas y acreditadas.",
    how: [
      {
        title: "Consultar",
        steps: [
          "Elige el rango \"Desde\" y \"Hasta\".",
          "Filtra por estado: Todos, Confirmados, Borradores o Anulados.",
          "Cada comprobante muestra sus líneas (cuenta, descripción, débito y crédito) y su total.",
        ],
      },
    ],
    tips: ["Es la forma más rápida de revisar qué se registró en un día: elige el mismo día en Desde y Hasta."],
  },
  {
    group: "Contabilidad",
    title: "Bancos",
    intro: "Maneja las cuentas bancarias, sus movimientos y la conciliación con el extracto.",
    how: [
      {
        title: "Crear una cuenta bancaria",
        steps: ["Pestaña Cuentas bancarias: escribe el banco, el número y el tipo (Ahorros o Corriente) y pulsa \"Crear\"."],
      },
      {
        title: "Registrar movimientos a mano",
        steps: [
          "Pestaña Movimientos: elige la cuenta, escribe la descripción, el monto y si es Crédito (entrada) o Débito (salida), y pulsa \"Registrar\".",
        ],
      },
      {
        title: "Leer un extracto con foto o PDF",
        steps: [
          "En \"Leer extracto bancario automáticamente\" elige la cuenta y pulsa \"Leer extracto (foto/PDF)\". Sirven fotos JPG, PNG o WEBP, o el PDF que descargas del banco.",
          "Contapro lista los movimientos que encontró: fecha, descripción, monto y si es entrada o salida.",
          "Revisa la lista y desmarca los que no correspondan (por ejemplo, movimientos que ya registraste).",
          "Confirma: los marcados quedan registrados como movimientos de la cuenta.",
        ],
      },
      {
        title: "Conciliar",
        steps: [
          "Pestaña Conciliaciones: elige la cuenta, el período y el saldo del extracto, y pulsa \"Iniciar\".",
          "Contapro muestra la diferencia entre el extracto y los libros, y \"Sugerencias de conciliación\" (movimientos que parecen iguales). Confírmalas o usa \"Emparejar a mano\".",
          "Cuando la diferencia sea cero, pulsa \"Cerrar conciliación\".",
        ],
      },
    ],
    tips: ["La lectura de extractos usa inteligencia artificial: revisa siempre la lista antes de confirmar. Si una foto sale borrosa, usa mejor el PDF del banco."],
  },
  {
    group: "Contabilidad",
    title: "Exógena DIAN",
    intro: "Genera la información exógena nacional a partir de lo que ya está registrado en Contapro.",
    how: [
      {
        title: "Generar un formato",
        steps: [
          "Elige el año y el formato: 1001 (pagos a proveedores), 1003 (retenciones practicadas), 1007 (ingresos por cliente), 1008 (saldos por cobrar) o 1009 (saldos por pagar).",
          "Revisa la tabla. Los terceros marcados \"incompleto\" no tienen código DANE de municipio: complétalo en el cliente o proveedor.",
          "Pulsa \"Descargar archivo plano\" y valida el archivo con el prevalidador de la DIAN antes de presentarlo.",
        ],
      },
    ],
    tips: [
      "Los saldos de 1008 y 1009 son los actuales; genéralos poco después del 31 de diciembre para que coincidan con esa fecha.",
      "Contapro no genera la exógena distrital (Secretaría de Hacienda).",
    ],
  },

  // ---------------------------------------------------------------- COMPRAS
  {
    group: "Compras",
    title: "Registrar compra",
    intro: "Registra las facturas de tus proveedores. La mercancía entra al inventario con su costo, la deuda queda en cuentas por pagar y todo se contabiliza solo. Puedes registrarla con una foto de la factura.",
    how: [
      {
        title: "Opción A: con foto o PDF de la factura",
        steps: [
          "En \"Leer factura automáticamente\" pulsa \"Leer factura (foto/PDF)\" y elige la foto (JPG, PNG o WEBP) o el PDF de la factura. Desde el celular puedes tomar la foto en ese momento.",
          "Espera unos segundos: Contapro lee el proveedor, el número de factura, las fechas, el subtotal, el IVA y los productos, y llena el formulario.",
          "Si no reconoce al proveedor, aparece \"No se pudo identificar el proveedor automáticamente\": elígelo en la lista (o créalo primero en Compras → Proveedores).",
          "Revisa cada dato contra la factura física. Corrige lo que haga falta.",
          "Revisa \"Productos que entran al inventario\": cada renglón de la factura aparece como \"Ya existe: elegirlo del inventario\" (si Contapro encontró el producto) o \"No existe: crearlo como producto nuevo\" (escribe su precio de venta sin IVA).",
          "Los productos deben sumar igual al subtotal de la factura; Contapro te lo indica abajo.",
          "Confirma con \"Registrar compra\".",
        ],
      },
      {
        title: "Opción B: a mano",
        steps: [
          "Elige el proveedor, escribe el número de la factura, el subtotal y el IVA (puedes escribir el IVA % y Contapro calcula el valor), y la fecha de vencimiento.",
          "Si el proveedor te practica retenciones, usa \"+ agregar retención\" (concepto y base).",
          "Si la compra es de mercancía, pulsa \"agregar producto\" en \"Productos que entran al inventario\" y llena producto, cantidad y costo unitario antes de IVA.",
          "Pulsa \"Registrar compra\".",
        ],
      },
    ],
    accounting: [
      "Comprobante \"Compra factura (número)\": aumenta el inventario (1435) o el gasto, registra el IVA descontable y crea la deuda con el proveedor (2205 Proveedores). Si hubo retención, aparece como \"Retención practicada al proveedor\".",
      "La factura queda en Compras → Proveedores → Cuentas por pagar hasta que la pagues.",
    ],
    tips: [
      "La lectura con foto usa inteligencia artificial: siempre revisa antes de guardar. Una foto derecha, con buena luz y sin sombras se lee mejor; si tienes el PDF del proveedor, úsalo.",
      "Si una compra quedó mal, puedes cancelarla en la lista de Compras: se reversa la entrada de inventario.",
    ],
  },
  {
    group: "Compras",
    title: "Proveedores",
    intro: "Lista de proveedores, historial de compras y las cuentas por pagar.",
    how: [
      {
        title: "Crear un proveedor",
        steps: [
          "Pestaña Proveedores: escribe el nombre, el NIT o documento, el contacto, el teléfono y el código DANE del municipio (lo necesita la exógena).",
          "Marca \"Obligado a facturar electrónicamente\" si aplica, y pulsa \"Crear\".",
        ],
      },
      {
        title: "Pagarle a un proveedor",
        steps: [
          "Pestaña Cuentas por pagar: ves cada factura con su saldo y vencimiento.",
          "Pulsa \"Abonar\", escribe el monto (puede ser un pago parcial), elige Efectivo, Tarjeta o Transferencia y pulsa \"Confirmar\".",
          "Con \"Imprimir recibo\" sacas el comprobante del pago.",
        ],
      },
    ],
    accounting: ["Cada pago genera el comprobante \"Abono a proveedor (nombre)\": disminuye Proveedores y sale el dinero de Caja o Bancos."],
  },
  {
    group: "Compras",
    title: "Órdenes de compra",
    intro: "Para pedirle mercancía a un proveedor antes de que llegue, y registrar la recepción cuando llega.",
    how: [
      {
        title: "Crear y enviar una orden",
        steps: [
          "Elige el proveedor, agrega los productos con cantidad y costo (\"+ Item\") y pulsa \"Crear orden\".",
          "Pulsa \"Imprimir\" para mandársela al proveedor, y \"Enviar\" para marcarla como enviada.",
        ],
      },
      {
        title: "Recibir la mercancía",
        steps: [
          "Pulsa \"Registrar recepción de mercancía\", elige la orden y escribe lo que realmente llegó (cantidad, costo, y si aplica, lote y vencimiento).",
          "Pulsa \"Registrar recepción\": la mercancía entra al inventario.",
        ],
      },
    ],
    tips: ["Cuando llegue la factura del proveedor, regístrala en Registrar compra para crear la cuenta por pagar."],
  },
  {
    group: "Compras",
    title: "Gastos",
    intro: "Registra los gastos del negocio que no son mercancía: arriendo, servicios públicos, transporte, papelería, etc.",
    how: [
      {
        title: "Crear las categorías (una sola vez)",
        steps: [
          "Pestaña Categorías: escribe el código, el nombre (ej. Arriendo) y la cuenta PUC donde se contabiliza (ej. 5120). Pulsa \"Crear\".",
        ],
      },
      {
        title: "Registrar un gasto",
        steps: [
          "Pestaña Gastos: elige la categoría, escribe a quién se le pagó (\"Pagado a\"), la descripción, el subtotal sin IVA y el IVA %.",
          "Elige cómo se pagó: Efectivo, Tarjeta o Transferencia. Si usas centros de costo, elígelo.",
          "Pulsa \"Registrar gasto\". Con \"Imprimir\" sacas el comprobante.",
        ],
      },
    ],
    accounting: ["Comprobante \"Gasto: (pagado a)\": se registra en la cuenta de la categoría y sale el dinero de Caja o Bancos."],
    tips: ["Los gastos se registran a mano: esta pantalla no lee fotos. Guarda el soporte físico o digital del gasto. Si el gasto es una factura de proveedor a crédito, regístrala mejor en Registrar compra."],
  },

  // ---------------------------------------------------------------- COBRANZA
  {
    group: "Cobranza",
    title: "Cuentas por cobrar",
    intro: "Aquí quedan las ventas a crédito, con su saldo y fecha de vencimiento.",
    how: [
      {
        title: "Registrar un pago del cliente",
        steps: [
          "Busca la cuenta y pulsa \"Abonar\". Escribe el monto (puede ser parcial) y elige Efectivo, Tarjeta o Transferencia. Pulsa \"Confirmar\".",
          "Con \"Imprimir recibo\" le entregas el comprobante al cliente.",
        ],
      },
      {
        title: "Cobrar en línea",
        steps: ["Pulsa \"Generar link de pago\" y envíale el enlace al cliente: paga directo con tarjeta o PSE y el abono se registra solo."],
      },
    ],
    accounting: ["Cada abono genera el comprobante \"Cobro a (cliente)\": entra el dinero a Caja o Bancos y disminuye Clientes (1305)."],
  },

  // ---------------------------------------------------------------- NOMINA
  {
    group: "Nómina",
    title: "Empleados",
    intro: "Registro de los empleados con su contrato, salario y seguridad social.",
    how: [
      {
        title: "Crear un empleado",
        steps: [
          "En \"Nuevo empleado\" escribe cédula, nombres, apellidos, cargo, salario base, fecha de ingreso, tipo de contrato, EPS, fondo de pensión y caja de compensación. Pulsa \"Crear\".",
          "Para que el empleado pueda pedir vacaciones y marcar horario, vincúlalo a su usuario en \"Usuario de cada empleado\".",
          "Si se retira, usa \"Dar de baja\".",
        ],
      },
    ],
  },
  {
    group: "Nómina",
    title: "Nómina",
    intro: "Liquida la nómina por períodos con los parámetros legales de Colombia.",
    how: [
      {
        title: "Liquidar un período",
        steps: [
          "Revisa una vez al año los \"Parámetros legales por año\" (salario mínimo, auxilio de transporte, porcentajes de salud, pensión, ARL, prestaciones y parafiscales).",
          "En \"Nuevo período de nómina\" elige el año, el mes y las fechas, y pulsa \"Crear período\".",
          "Pulsa \"Calcular\": verás devengado, deducciones, neto a pagar y costo del empleador de cada empleado.",
          "Revisa y pulsa \"Aprobar\". Cuando pagues, pulsa \"Pagar\".",
          "\"Desprendible PDF\" genera el comprobante de pago de cada empleado (también se puede enviar por WhatsApp).",
        ],
      },
      {
        title: "Libranzas y embargos",
        steps: ["En \"Deducciones recurrentes\" registra la libranza o el embargo del empleado con la cuota por período; se descuenta sola en cada nómina."],
      },
    ],
    accounting: ["Al aprobar el período se genera el comprobante \"Nómina mes/año\" con salarios, seguridad social, prestaciones y aportes."],
  },
  {
    group: "Nómina",
    title: "Horarios",
    intro: "Control de entrada y salida de los empleados.",
    how: [
      {
        title: "Marcar",
        steps: [
          "En \"Mi marcación\" pulsa \"Marcar entrada\" al llegar y \"Marcar salida\" al irte. Tu usuario debe estar vinculado a un empleado.",
          "Un administrador puede usar \"Marcar por otro empleado\".",
          "En \"Registros\" se consultan las marcaciones por empleado y fechas, con la duración de cada jornada.",
        ],
      },
    ],
  },
  {
    group: "Nómina",
    title: "Vacaciones",
    intro: "Solicitudes y control de vacaciones, permisos, incapacidades y ausencias.",
    how: [
      {
        title: "Si eres empleado",
        steps: [
          "Elige la pestaña (Vacaciones, Permisos o Incapacidades), las fechas y el tipo, y pulsa \"Solicitar\" (o \"Radicar\" para incapacidades).",
          "La respuesta te aparece en el Dashboard: aprobada (con las fechas, por si te las cambiaron) o rechazada (con el motivo).",
        ],
      },
      {
        title: "Si eres administrador",
        steps: [
          "En el Dashboard verás \"Tienes N solicitudes por revisar\".",
          "Pulsa \"Aprobar\": puedes aprobar con las fechas pedidas o cambiarlas y dejar una nota.",
          "Pulsa \"Rechazar\": escribe el motivo (el empleado lo ve).",
          "En Ausencias registras faltas, justificadas o injustificadas.",
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- CLIENTES
  {
    group: "Clientes",
    title: "Clientes",
    intro: "Registro de clientes con su cupo de crédito, saldo y lista de precios.",
    how: [
      {
        title: "Crear un cliente",
        steps: [
          "Elige el tipo de documento (Cédula, NIT, Cédula de extranjería o Pasaporte) y escribe el número, el nombre, el correo, el teléfono y la dirección.",
          "Escribe el cupo de crédito si le vendes a crédito, y el código DANE del municipio (lo pide la factura electrónica y la exógena).",
          "En \"Datos tributarios para la factura electrónica\" marca, según el RUT del cliente, si es responsable de IVA y sus responsabilidades (gran contribuyente, autorretenedor, agente de retención de IVA, régimen simple).",
          "Pulsa \"Crear\". En la lista puedes cambiar su lista de precios.",
        ],
      },
    ],
  },
  {
    group: "Clientes",
    title: "Oportunidades",
    intro: "Embudo de negociaciones: clientes potenciales y propuestas en curso.",
    how: [
      {
        title: "Usarlo",
        steps: [
          "Crea una oportunidad con título, cliente, productos y cierre esperado.",
          "Muévela entre etapas según avance la negociación.",
          "Si se gana, pulsa \"Cerrar ganada\": se convierte automáticamente en una venta (a crédito por defecto). Si se pierde, \"Marcar perdida\" con el motivo.",
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- OTROS
  {
    group: "Otros",
    title: "Comisiones",
    intro: "Calcula y paga comisiones a los vendedores sobre sus ventas.",
    how: [
      {
        title: "Usarlo",
        steps: [
          "Pestaña Esquemas: elige el vendedor y su tarifa % y pulsa \"Crear\".",
          "Pestaña Liquidaciones: elige año y mes y pulsa \"Calcular comisiones del período\". Verás la base (ventas) y la comisión de cada vendedor.",
          "Pulsa \"Pagar\", elige el medio de pago y confirma.",
        ],
      },
    ],
    accounting: ["Cada pago genera el comprobante \"Comisión de venta: (vendedor)\"."],
  },
  {
    group: "Otros",
    title: "Activos fijos",
    intro: "Lleva la depreciación de equipos, muebles, vehículos y otros activos.",
    how: [
      {
        title: "Usarlo",
        steps: [
          "Crea el activo con su nombre, costo, valor residual, vida útil en meses y fecha de compra. (Registrar el activo aquí no contabiliza la compra: esa va por Compras o Gastos.)",
          "Pestaña Depreciación: elige año y mes, pulsa \"Calcular depreciación del período\" y luego \"Contabilizar\".",
          "Si el activo se vende o se daña, usa \"Dar de baja\".",
        ],
      },
    ],
    accounting: ["Cada mes contabilizado genera el comprobante \"Depreciación: (activo)\"."],
  },
  {
    group: "Otros",
    title: "Facturación recurrente",
    intro: "Para cobros que se repiten cada mes (mantenimientos, arriendos, mensualidades): Contapro crea la venta sola el día indicado.",
    how: [
      {
        title: "Crear una plantilla",
        steps: [
          "Pulsa \"Nueva plantilla\": nombre, cliente, día del mes (1 a 28), días de plazo y productos.",
          "Pulsa \"Crear plantilla\". En la lista ves la próxima y la última ejecución, y el historial de cada una.",
          "Para detenerla, \"Desactivar\".",
        ],
      },
    ],
  },
  {
    group: "Otros",
    title: "Integraciones",
    intro: "Conecta Contapro con otros sistemas y configura la facturación electrónica.",
    how: [
      {
        title: "Facturación electrónica (DIAN)",
        steps: [
          "Muestra el proveedor tecnológico de tu empresa y cuántos documentos electrónicos llevas en el mes frente al tope de tu plan.",
          "Las credenciales del proveedor las carga el equipo de Contapro durante la activación.",
        ],
      },
      {
        title: "API keys y webhooks (para desarrolladores)",
        steps: [
          "\"Nueva API key\": para que otro sistema (una tienda en línea, otro POS) cree ventas, clientes o productos en Contapro. Elige los permisos (scopes). La clave se muestra una sola vez: guárdala.",
          "\"Nuevo webhook\": para que Contapro avise a otro sistema cuando pasa algo (por ejemplo, una venta creada).",
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- CONFIGURACION
  {
    group: "Configuración",
    title: "Datos de la empresa",
    intro: "El perfil fiscal de tu empresa: aparece en facturas, tirillas y reportes.",
    how: [
      {
        title: "Completar",
        steps: [
          "Escribe razón social, tipo de documento, NIT y dígito de verificación, responsabilidad tributaria, régimen, dirección, municipio, departamento, código DANE y teléfono.",
          "Pulsa \"Guardar\". Hazlo antes de emitir tu primera factura.",
        ],
      },
    ],
  },
  {
    group: "Configuración",
    title: "Roles y permisos",
    intro: "Usuarios, roles y lo que cada uno puede hacer.",
    how: [
      {
        title: "Crear un usuario",
        steps: [
          "En \"Nuevo usuario\" escribe el nombre completo, el correo, una contraseña de al menos 8 caracteres, el rol y la sucursal. Pulsa \"Crear usuario\".",
          "Entrégale al usuario su correo y contraseña. Él entra con esos datos.",
        ],
      },
      {
        title: "Roles",
        steps: [
          "Contapro trae roles listos (Administrador, Cajero, etc.). Puedes crear los tuyos con \"Nuevo rol\" y \"Editar permisos\".",
          "En \"Permisos individuales\" das o quitas un permiso a una persona sin cambiar su rol.",
          "En \"Sucursales de cada usuario\" eliges en qué sucursales puede trabajar cada uno.",
        ],
      },
    ],
  },
  {
    group: "Configuración",
    title: "Auditoría",
    intro: "El historial de todo lo que pasa en el sistema: quién hizo qué y cuándo (cambios de precio, ventas, anulaciones, cierres de caja, etc.).",
    how: [
      {
        title: "Consultar",
        steps: ["Filtra por tipo de entidad (ej. Sale, Product, Employee), por acción o por un registro específico. Usa \"Anterior\" y \"Siguiente\" para recorrer. El historial no se puede borrar ni editar."],
      },
    ],
  },
  {
    group: "Configuración",
    title: "Mi suscripción",
    intro: "Tu plan de Contapro, su vencimiento y el pago.",
    how: [
      {
        title: "Pagar o cambiar de plan",
        steps: [
          "Verás el plan actual, el ciclo (mensual o anual), el vencimiento y el precio.",
          "Elige el plan y pulsa \"Pagar ahora\": pagas en línea con tarjeta o PSE y el plan se activa solo.",
          "En \"Renovación automática\" puedes guardar una tarjeta para que el pago se haga solo cada período. Se puede cancelar cuando quieras.",
        ],
      },
    ],
  },
  {
    group: "Configuración",
    title: "Ver manual",
    intro: "Abre este manual en una pestaña nueva. Puedes descargarlo o imprimirlo.",
    how: [],
  },
];

/** Capitulo final: como comprobar que la contabilidad quedo bien. */
export const CHECK_ACCOUNTING = {
  intro:
    "Cada operación genera su comprobante contable de forma automática. Para revisar que algo quedó bien registrado, sigue estos pasos:",
  table: [
    ["Venta en el punto de venta", "Venta #número", "Caja / Bancos / Clientes contra Ingresos (4135) e IVA (2408); Costo de ventas (6135) contra Inventario (1435)"],
    ["Compra a proveedor", "Compra factura (número)", "Inventario (1435) o gasto e IVA descontable contra Proveedores (2205)"],
    ["Gasto", "Gasto: (pagado a)", "Cuenta de la categoría contra Caja / Bancos"],
    ["Pago a proveedor", "Abono a proveedor (nombre)", "Proveedores (2205) contra Caja / Bancos"],
    ["Cobro a cliente", "Cobro a (cliente)", "Caja / Bancos contra Clientes (1305)"],
    ["Devolución", "Devolución de venta", "Reversa ingreso, IVA y, si se repone, inventario"],
    ["Cierre de caja con diferencia", "Faltante / Sobrante de caja en arqueo", "Ajuste contra Caja"],
    ["Nómina aprobada", "Nómina mes/año", "Gastos de personal y aportes contra Bancos y pasivos laborales"],
    ["Depreciación", "Depreciación: (activo)", "Gasto de depreciación contra Depreciación acumulada"],
  ],
  steps: [
    "Ve a Contabilidad → Comprobantes (o a Libro Diario) y busca por fecha. Encontrarás el comprobante con la descripción de la tabla de arriba.",
    "Ábrelo y revisa sus líneas: cuentas, débitos y créditos. Los débitos siempre suman igual que los créditos.",
    "Para una cuenta en particular (por ejemplo, Caja), ve a Contabilidad → Reportes → Libro mayor: verás cada movimiento con el saldo.",
    "Para el inventario de un producto, ve a Inventario → Kardex: cada compra y venta aparece con la cantidad y el costo promedio.",
    "Revisa el Balance General: el total de Activos debe ser igual a Pasivos más Patrimonio.",
    "Si algo quedó mal: anula el comprobante manual con \"Anular comprobante\", cancela la compra en su lista, registra una devolución para una venta, o pídele a tu contador un comprobante manual de ajuste.",
  ],
};
