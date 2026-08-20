import type { Prisma } from "@prisma/client";

type PucAccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";

interface PucAccountDef {
  code: string;
  name: string;
  type: PucAccountType;
  /** false = cuenta de agrupacion (clase/grupo, o "cuenta" que se subdivide en subcuentas), no
   * admite movimientos directos. */
  acceptsEntries: boolean;
  /** true = ya viene activada al crear la empresa -- o porque es estructural (agrupa el arbol,
   * siempre visible) o porque el motor contable ya la usa automaticamente sin esperar a que el
   * usuario la active (ver STANDARD_ACCOUNTS en cada Post*JournalEntryUseCase de
   * apps/api/src/modules/accounting/application/use-cases/, deben coincidir codigo/nombre/tipo
   * EXACTO con lo de aca -- upsertByCode no renombra una cuenta que ya existe). false = queda
   * como plantilla inactiva para que el usuario la active manualmente desde "Plan de cuentas"
   * cuando la necesite. */
  active: boolean;
}

/**
 * Plan unico de cuentas (PUC) con el que arranca cada empresa nueva, siempre en el mismo estado
 * inicial: la jerarquia completa (clase -> grupo -> cuenta -> subcuenta) precargada, pero solo
 * las cuentas que el motor contable ya usa de entrada quedan activas -- el resto es catalogo de
 * referencia que el usuario activa con un clic desde "Plan de cuentas" a medida que las necesita,
 * sin tener que escribir codigo ni nombre a mano (item 44 de docs/ALCANCE.md).
 *
 * **No es la codificacion oficial completa del Decreto 2650** (esa tiene miles de cuentas
 * auxiliares, muchas irrelevantes para una pyme de comercio: seguros especializados, comercio
 * exterior, agricultura, entidades financieras, etc.) -- es un PUC simplificado para pymes de
 * comercio/servicios colombianas, sin verificar contra un contador real (mismo criterio de
 * honestidad que DEFAULT_WITHHOLDING_CONCEPTS/DEFAULT_EXPENSE_CATEGORIES). Cubre clases 1-6
 * (Activo/Pasivo/Patrimonio/Ingresos/Gastos/Costos de Ventas); se omite la clase 7 (Costos de
 * Produccion, manufactura) y las clases 8-9 (cuentas de orden) por estar fuera del alcance actual
 * del producto.
 *
 * Los codigos 5155/5165 usan el nombre de DEFAULT_EXPENSE_CATEGORIES (Papeleria/Publicidad) en
 * vez del nombre oficial del PUC (que ahi cubriria otro concepto) para no pisar el nombre que
 * PostExpenseJournalEntryUseCase ya le pone a esa cuenta la primera vez que se usa una categoria
 * de gasto -- mismo codigo, mismo criterio de "que gane el que ya esta hardcodeado en el motor".
 * El codigo 5135 tiene la misma tension con la categoria "Servicios publicos" (ver
 * seed-expense-categories.ts) pero ahi gana el nombre de PostCommissionJournalEntryUseCase
 * ("Comisiones") porque ese codigo esta en la lista de cuentas ya activas de entrada; no afecta
 * el registro de un gasto de categoria "Servicios publicos" (la descripcion de esa linea del
 * comprobante sigue tomando el nombre de la categoria, no el de la cuenta).
 */
export const DEFAULT_CHART_OF_ACCOUNTS: PucAccountDef[] = [
  // ---- 1 ACTIVO ----
  { code: "1", name: "Activo", type: "ASSET", acceptsEntries: false, active: true },
  { code: "11", name: "Disponible", type: "ASSET", acceptsEntries: false, active: true },
  { code: "1105", name: "Caja general", type: "ASSET", acceptsEntries: true, active: true },
  { code: "1110", name: "Bancos", type: "ASSET", acceptsEntries: true, active: true },
  { code: "1120", name: "Cuentas de ahorro", type: "ASSET", acceptsEntries: true, active: false },
  { code: "12", name: "Inversiones", type: "ASSET", acceptsEntries: false, active: true },
  { code: "1205", name: "Acciones", type: "ASSET", acceptsEntries: true, active: false },
  { code: "1225", name: "Certificados de deposito a termino", type: "ASSET", acceptsEntries: true, active: false },
  { code: "13", name: "Deudores", type: "ASSET", acceptsEntries: false, active: true },
  { code: "1305", name: "Clientes (cuentas por cobrar)", type: "ASSET", acceptsEntries: true, active: true },
  { code: "1330", name: "Anticipos y avances", type: "ASSET", acceptsEntries: true, active: false },
  { code: "1355", name: "Anticipo de impuestos y contribuciones", type: "ASSET", acceptsEntries: false, active: true },
  { code: "135515", name: "Anticipo de impuestos - Retencion en la fuente", type: "ASSET", acceptsEntries: true, active: true },
  { code: "135517", name: "Anticipo de impuestos - Retencion de ICA", type: "ASSET", acceptsEntries: true, active: true },
  { code: "135518", name: "Anticipo de impuestos - Retencion de IVA", type: "ASSET", acceptsEntries: true, active: true },
  { code: "1360", name: "Cuentas por cobrar a trabajadores", type: "ASSET", acceptsEntries: true, active: false },
  { code: "1365", name: "Cuentas por cobrar a socios o accionistas", type: "ASSET", acceptsEntries: true, active: false },
  { code: "1380", name: "Deudores varios", type: "ASSET", acceptsEntries: true, active: false },
  { code: "14", name: "Inventarios", type: "ASSET", acceptsEntries: false, active: true },
  { code: "1405", name: "Materias primas", type: "ASSET", acceptsEntries: true, active: false },
  { code: "1410", name: "Productos en proceso", type: "ASSET", acceptsEntries: true, active: false },
  { code: "1430", name: "Productos terminados", type: "ASSET", acceptsEntries: true, active: false },
  { code: "1435", name: "Inventarios - mercancias no fabricadas por la empresa", type: "ASSET", acceptsEntries: true, active: true },
  { code: "15", name: "Propiedades, planta y equipo", type: "ASSET", acceptsEntries: false, active: true },
  { code: "1504", name: "Terrenos", type: "ASSET", acceptsEntries: true, active: false },
  { code: "1516", name: "Construcciones y edificaciones", type: "ASSET", acceptsEntries: true, active: false },
  { code: "1520", name: "Maquinaria y equipo", type: "ASSET", acceptsEntries: true, active: false },
  { code: "1524", name: "Equipo de oficina", type: "ASSET", acceptsEntries: true, active: false },
  { code: "1528", name: "Equipo de computacion y comunicacion", type: "ASSET", acceptsEntries: true, active: false },
  { code: "1540", name: "Flota y equipo de transporte", type: "ASSET", acceptsEntries: true, active: false },
  { code: "1592", name: "Depreciacion acumulada", type: "ASSET", acceptsEntries: true, active: true },
  { code: "16", name: "Intangibles", type: "ASSET", acceptsEntries: false, active: true },
  { code: "1605", name: "Credito mercantil", type: "ASSET", acceptsEntries: true, active: false },
  { code: "1610", name: "Marcas", type: "ASSET", acceptsEntries: true, active: false },
  { code: "1615", name: "Patentes", type: "ASSET", acceptsEntries: true, active: false },
  { code: "17", name: "Diferidos", type: "ASSET", acceptsEntries: false, active: true },
  { code: "1705", name: "Gastos pagados por anticipado", type: "ASSET", acceptsEntries: true, active: false },
  { code: "18", name: "Otros activos", type: "ASSET", acceptsEntries: false, active: true },
  { code: "1805", name: "Bienes de arte y cultura", type: "ASSET", acceptsEntries: true, active: false },

  // ---- 2 PASIVO ----
  { code: "2", name: "Pasivo", type: "LIABILITY", acceptsEntries: false, active: true },
  { code: "21", name: "Obligaciones financieras", type: "LIABILITY", acceptsEntries: false, active: true },
  { code: "2105", name: "Bancos nacionales", type: "LIABILITY", acceptsEntries: true, active: false },
  { code: "2110", name: "Corporaciones financieras", type: "LIABILITY", acceptsEntries: true, active: false },
  { code: "22", name: "Proveedores", type: "LIABILITY", acceptsEntries: false, active: true },
  { code: "2205", name: "Proveedores nacionales", type: "LIABILITY", acceptsEntries: true, active: true },
  { code: "2210", name: "Proveedores del exterior", type: "LIABILITY", acceptsEntries: true, active: false },
  { code: "23", name: "Cuentas por pagar", type: "LIABILITY", acceptsEntries: false, active: true },
  { code: "2335", name: "Costos y gastos por pagar", type: "LIABILITY", acceptsEntries: true, active: false },
  { code: "2365", name: "Retencion en la fuente", type: "LIABILITY", acceptsEntries: false, active: true },
  { code: "236540", name: "Retencion en la fuente por pagar", type: "LIABILITY", acceptsEntries: true, active: true },
  { code: "2367", name: "Impuesto a las ventas retenido", type: "LIABILITY", acceptsEntries: false, active: true },
  { code: "236705", name: "Retencion de IVA por pagar", type: "LIABILITY", acceptsEntries: true, active: true },
  { code: "2368", name: "Impuesto de industria y comercio retenido", type: "LIABILITY", acceptsEntries: false, active: true },
  { code: "236801", name: "Retencion de ICA por pagar", type: "LIABILITY", acceptsEntries: true, active: true },
  { code: "2370", name: "Retenciones y aportes de nomina por pagar", type: "LIABILITY", acceptsEntries: true, active: true },
  { code: "2380", name: "Aportes patronales por pagar", type: "LIABILITY", acceptsEntries: true, active: true },
  { code: "24", name: "Impuestos, gravamenes y tasas", type: "LIABILITY", acceptsEntries: false, active: true },
  { code: "2404", name: "De renta y complementarios", type: "LIABILITY", acceptsEntries: true, active: false },
  { code: "2408", name: "Impuesto sobre las ventas por pagar", type: "LIABILITY", acceptsEntries: true, active: true },
  { code: "25", name: "Obligaciones laborales", type: "LIABILITY", acceptsEntries: false, active: true },
  { code: "2505", name: "Salarios por pagar", type: "LIABILITY", acceptsEntries: true, active: true },
  { code: "2510", name: "Cesantias consolidadas", type: "LIABILITY", acceptsEntries: true, active: false },
  { code: "2515", name: "Intereses sobre cesantias", type: "LIABILITY", acceptsEntries: true, active: false },
  { code: "2520", name: "Prima de servicios", type: "LIABILITY", acceptsEntries: true, active: false },
  { code: "2525", name: "Vacaciones consolidadas", type: "LIABILITY", acceptsEntries: true, active: false },
  { code: "26", name: "Pasivos estimados y provisiones", type: "LIABILITY", acceptsEntries: false, active: true },
  { code: "2610", name: "Provisiones para obligaciones laborales", type: "LIABILITY", acceptsEntries: true, active: true },
  { code: "28", name: "Otros pasivos", type: "LIABILITY", acceptsEntries: false, active: true },
  { code: "2805", name: "Anticipos y avances recibidos", type: "LIABILITY", acceptsEntries: true, active: false },

  // ---- 3 PATRIMONIO ----
  { code: "3", name: "Patrimonio", type: "EQUITY", acceptsEntries: false, active: true },
  { code: "31", name: "Capital social", type: "EQUITY", acceptsEntries: false, active: true },
  { code: "3115", name: "Aportes sociales", type: "EQUITY", acceptsEntries: true, active: false },
  { code: "33", name: "Reservas", type: "EQUITY", acceptsEntries: false, active: true },
  { code: "3305", name: "Reserva legal", type: "EQUITY", acceptsEntries: true, active: false },
  { code: "36", name: "Resultados del ejercicio", type: "EQUITY", acceptsEntries: false, active: true },
  { code: "3605", name: "Utilidad del ejercicio", type: "EQUITY", acceptsEntries: true, active: false },
  { code: "37", name: "Resultados de ejercicios anteriores", type: "EQUITY", acceptsEntries: false, active: true },
  { code: "3705", name: "Utilidades acumuladas", type: "EQUITY", acceptsEntries: true, active: false },

  // ---- 4 INGRESOS ----
  { code: "4", name: "Ingresos", type: "INCOME", acceptsEntries: false, active: true },
  { code: "41", name: "Operacionales", type: "INCOME", acceptsEntries: false, active: true },
  { code: "4135", name: "Comercio al por mayor y al por menor", type: "INCOME", acceptsEntries: true, active: true },
  { code: "42", name: "No operacionales", type: "INCOME", acceptsEntries: false, active: true },
  { code: "4210", name: "Financieros", type: "INCOME", acceptsEntries: true, active: false },
  { code: "4295", name: "Diversos (otros ingresos)", type: "INCOME", acceptsEntries: true, active: true },

  // ---- 5 GASTOS ----
  { code: "5", name: "Gastos", type: "EXPENSE", acceptsEntries: false, active: true },
  { code: "51", name: "Operacionales de administracion", type: "EXPENSE", acceptsEntries: false, active: true },
  { code: "5105", name: "Gastos de personal - sueldos", type: "EXPENSE", acceptsEntries: true, active: true },
  { code: "5107", name: "Aportes sobre la nomina", type: "EXPENSE", acceptsEntries: true, active: true },
  { code: "5108", name: "Provisiones de prestaciones sociales", type: "EXPENSE", acceptsEntries: true, active: true },
  { code: "5110", name: "Honorarios", type: "EXPENSE", acceptsEntries: true, active: false },
  { code: "5115", name: "Impuestos", type: "EXPENSE", acceptsEntries: true, active: false },
  { code: "5120", name: "Arrendamientos", type: "EXPENSE", acceptsEntries: true, active: false },
  { code: "5135", name: "Comisiones", type: "EXPENSE", acceptsEntries: true, active: true },
  { code: "5140", name: "Legales", type: "EXPENSE", acceptsEntries: true, active: false },
  { code: "5145", name: "Mantenimiento y reparaciones", type: "EXPENSE", acceptsEntries: true, active: false },
  { code: "5150", name: "Adecuacion e instalacion", type: "EXPENSE", acceptsEntries: true, active: false },
  { code: "5155", name: "Papeleria y utiles de oficina", type: "EXPENSE", acceptsEntries: true, active: false },
  { code: "5160", name: "Depreciacion", type: "EXPENSE", acceptsEntries: true, active: true },
  { code: "5165", name: "Publicidad y propaganda", type: "EXPENSE", acceptsEntries: true, active: false },
  { code: "5195", name: "Diversos (gastos)", type: "EXPENSE", acceptsEntries: true, active: true },

  // ---- 6 COSTOS DE VENTAS ----
  { code: "6", name: "Costos de ventas", type: "EXPENSE", acceptsEntries: false, active: true },
  { code: "61", name: "Costo de ventas y de prestacion de servicios", type: "EXPENSE", acceptsEntries: false, active: true },
  { code: "6135", name: "Costo de ventas", type: "EXPENSE", acceptsEntries: true, active: true },
];

const PARENT_CODE_LENGTH: Record<number, number> = { 2: 1, 4: 2, 6: 4 };

function parentCodeFor(code: string): string | null {
  const parentLength = PARENT_CODE_LENGTH[code.length];
  return parentLength ? code.slice(0, parentLength) : null;
}

function levelFor(code: string): number {
  return { 1: 1, 2: 2, 4: 3, 6: 4 }[code.length] ?? 1;
}

/**
 * Siembra el PUC por defecto para UNA empresa (idempotente, upsert por companyId+code -- no pisa
 * una cuenta que la empresa ya haya editado/renombrado/(des)activado desde la UI). Se inserta en
 * orden ascendente de longitud de codigo para poder resolver parentId por prefijo a medida que se
 * va creando (clase de 1 digito -> grupo de 2 -> cuenta de 4 -> subcuenta de 6, convencion
 * estandar del PUC colombiano). Dos llamadores, mismo patron que seedDefaultWithholdingConcepts/
 * seedDefaultExpenseCategories: RegisterCompanyUseCase (apps/api) justo despues de crear una
 * empresa nueva, y el loop de backfill en seedBase() (prisma/seed-base.ts) para empresas que ya
 * existian antes de este item.
 */
export async function seedDefaultChartOfAccounts(prisma: Prisma.TransactionClient, companyId: string) {
  const idByCode = new Map<string, string>();
  const byAscendingCodeLength = [...DEFAULT_CHART_OF_ACCOUNTS].sort((a, b) => a.code.length - b.code.length);

  for (const def of byAscendingCodeLength) {
    const parentCode = parentCodeFor(def.code);
    const parentId = parentCode ? idByCode.get(parentCode) ?? null : null;

    // update SI toca parentId/level/type/acceptsEntries (estructura del arbol, no algo que un
    // usuario "personalice") -- corrige cuentas legadas creadas antes de este item por
    // upsertByCode sin jerarquia (parentId null, level 1 siempre, ver STANDARD_ACCOUNTS en cada
    // Post*JournalEntryUseCase). NO toca name/isActive: esos si son del usuario (nombre editado,
    // activar/desactivar), un re-seed no los debe pisar.
    const row = await prisma.chartOfAccounts.upsert({
      where: { companyId_code: { companyId, code: def.code } },
      create: {
        companyId,
        code: def.code,
        name: def.name,
        type: def.type,
        parentId,
        level: levelFor(def.code),
        acceptsEntries: def.acceptsEntries,
        isActive: def.active,
      },
      update: {
        type: def.type,
        parentId,
        level: levelFor(def.code),
        acceptsEntries: def.acceptsEntries,
      },
    });
    idByCode.set(def.code, row.id);
  }
}
