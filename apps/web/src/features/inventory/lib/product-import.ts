// SheetJS pesa ~400 KB: se carga solo cuando alguien abre el importador, no en el bundle principal
// (que tambien sirve la landing publica).
const loadXlsx = () => import("xlsx");

/**
 * Lectura de Excel/CSV para la importacion masiva de productos, 100% en el navegador (SheetJS):
 * el archivo nunca se sube, solo las filas ya mapeadas a JSON. SheetJS lee .xlsx, el .xls viejo
 * y .csv -- cubre la plantilla propia y las exportaciones de Alegra/Siigo.
 */

export type ImportField =
  | "name"
  | "sku"
  | "barcode"
  | "price"
  | "cost"
  | "taxRate"
  | "category"
  | "initialStock"
  | "minStock"
  | "unit";

export const IMPORT_FIELDS: { field: ImportField; label: string; required?: boolean; numeric?: boolean }[] = [
  { field: "name", label: "Nombre", required: true },
  { field: "price", label: "Precio de venta", required: true, numeric: true },
  { field: "sku", label: "Referencia / SKU" },
  { field: "barcode", label: "Codigo de barras" },
  { field: "cost", label: "Costo", numeric: true },
  { field: "taxRate", label: "IVA (%)", numeric: true },
  { field: "category", label: "Categoria" },
  { field: "initialStock", label: "Stock inicial", numeric: true },
  { field: "minStock", label: "Stock minimo", numeric: true },
  { field: "unit", label: "Unidad" },
];

/**
 * Nombres de columna conocidos (plantilla propia + los que usan Alegra/Siigo en sus exportaciones,
 * que no se han verificado contra un archivo real -- si no se detecta una columna, el usuario la
 * elige a mano). Se comparan normalizados: minusculas, sin tildes ni signos. El orden importa: el
 * primer alias que coincida exacto gana; si ninguno coincide exacto, se busca por "empieza con".
 */
const ALIASES: Record<ImportField, string[]> = {
  name: ["nombre", "nombre del producto", "producto", "descripcion", "nombre item", "item"],
  sku: ["referencia", "sku", "codigo", "codigo producto", "codigo del producto", "cod", "ref", "codigo interno"],
  barcode: ["codigo de barras", "codigo barras", "cod barras", "ean", "barcode", "upc"],
  price: ["precio de venta", "precio venta", "precio", "precio base", "precio de venta 1", "precio venta 1", "valor", "valor unitario", "precio unitario"],
  cost: ["costo", "costo unitario", "costo inicial", "costo promedio", "precio de compra", "precio compra", "valor compra"],
  taxRate: ["iva", "iva %", "porcentaje iva", "tarifa iva", "impuesto", "impuestos", "impuesto cargo", "tarifa"],
  category: ["categoria", "grupo", "grupo de inventario", "linea", "familia", "categoria del producto"],
  initialStock: ["stock inicial", "stock", "cantidad", "cantidad inicial", "existencias", "inventario", "saldo", "cantidad disponible"],
  minStock: ["stock minimo", "minimo", "cantidad minima", "inventario minimo"],
  unit: ["unidad", "unidad de medida", "und", "um"],
};

export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9% ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ParsedSheet {
  headers: string[];
  /** Fila de encabezado en numeracion de Excel (1 = primera fila). */
  headerRowNumber: number;
  /** Filas de datos con su numero de fila real en Excel; las filas totalmente vacias se omiten. */
  rows: { rowNumber: number; cells: unknown[] }[];
}

export async function readSpreadsheet(file: File): Promise<ParsedSheet> {
  const XLSX = await loadXlsx();
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;
  if (!sheet) throw new Error("El archivo no tiene hojas");
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "", blankrows: true });

  // Las exportaciones suelen traer filas de titulo arriba ("Listado de productos", fecha...). El
  // encabezado es la primera fila (de las 15 primeras) con al menos 2 nombres de columna conocidos;
  // si ninguna los tiene, la primera fila no vacia.
  const firstNonEmpty = matrix.findIndex((r) => r.some((c) => String(c).trim() !== ""));
  if (firstNonEmpty === -1) throw new Error("El archivo esta vacio");
  let headerIndex = firstNonEmpty;
  for (let i = firstNonEmpty; i < Math.min(matrix.length, firstNonEmpty + 15); i++) {
    const known = (matrix[i] ?? []).filter((c) => matchField(normalizeHeader(c), "exact") !== null).length;
    if (known >= 2) {
      headerIndex = i;
      break;
    }
  }

  const headers = (matrix[headerIndex] ?? []).map((c) => String(c).trim());
  const rows = matrix
    .slice(headerIndex + 1)
    .map((cells, i) => ({ rowNumber: headerIndex + i + 2, cells }))
    .filter((r) => r.cells.some((c) => String(c).trim() !== ""));
  return { headers, headerRowNumber: headerIndex + 1, rows };
}

function matchField(header: string, mode: "exact" | "prefix"): ImportField | null {
  if (!header) return null;
  // Gana el alias mas largo que coincida: "precio compra unitario" es costo (alias "precio compra"),
  // no precio de venta (alias "precio"); "codigo de barras ean" es barras, no referencia ("codigo").
  let best: { field: ImportField; length: number } | null = null;
  for (const { field } of IMPORT_FIELDS) {
    for (const alias of ALIASES[field]) {
      const hit = mode === "exact" ? header === alias : header === alias || header.startsWith(`${alias} `);
      if (hit && (!best || alias.length > best.length)) best = { field, length: alias.length };
    }
  }
  return best?.field ?? null;
}

/** Columna (indice) asignada a cada campo; -1 = sin asignar. */
export type ColumnMapping = Record<ImportField, number>;

export function detectMapping(headers: string[]): ColumnMapping {
  const mapping = Object.fromEntries(IMPORT_FIELDS.map((f) => [f.field, -1])) as ColumnMapping;
  const normalized = headers.map(normalizeHeader);
  for (const mode of ["exact", "prefix"] as const) {
    normalized.forEach((header, index) => {
      if (Object.values(mapping).includes(index)) return;
      const field = matchField(header, mode);
      // El modo exacto corre primero en todas las columnas; el prefijo solo llena lo que quedo libre.
      if (field && mapping[field] === -1) mapping[field] = index;
    });
  }
  return mapping;
}

/**
 * Numero escrito a la colombiana o a la gringa: "$ 3.500", "3.500,50", "3,500.50", "19%", 0.19.
 * Devuelve undefined si la celda esta vacia y null si trae algo que no es un numero (la API lo
 * reporta como "Precio invalido" con su numero de fila).
 */
export function parseNumber(value: unknown): number | null | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let text = String(value ?? "").trim();
  if (text === "") return undefined;
  text = text.replace(/[$\s%]/g, "").replace(/^cop/i, "");
  const lastDot = text.lastIndexOf(".");
  const lastComma = text.lastIndexOf(",");
  if (lastDot !== -1 && lastComma !== -1) {
    // El ultimo separador que aparece es el decimal.
    text = lastComma > lastDot ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  } else if (lastComma !== -1) {
    text = /^-?\d{1,3}(,\d{3})+$/.test(text) ? text.replace(/,/g, "") : text.replace(",", ".");
  } else if (lastDot !== -1 && /^-?\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, "");
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/** IVA: "19%", "19", 0.19, "IVA 19%" -> 19. "Excluido"/"Exento" -> 0. */
export function parseTaxRate(value: unknown): number | null | undefined {
  const text = normalizeHeader(value);
  if (text === "") return undefined;
  if (/(excluid|exent|no aplica|sin iva|ninguno)/.test(text)) return 0;
  const direct = parseNumber(value);
  const parsed = direct ?? (text.match(/\d+([.,]\d+)?/) ? parseNumber(text.match(/\d+([.,]\d+)?/)![0]) : null);
  if (parsed === null || parsed === undefined) return parsed;
  return parsed > 0 && parsed < 1 ? Math.round(parsed * 10000) / 100 : parsed;
}

function parseText(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text === "" ? undefined : text;
}

/** Arma las filas que espera POST /products/import segun el mapeo de columnas elegido. */
export function buildImportRows(sheet: ParsedSheet, mapping: ColumnMapping) {
  const cell = (cells: unknown[], field: ImportField) => (mapping[field] >= 0 ? cells[mapping[field]] : undefined);
  const rows = sheet.rows.map(({ cells }) => {
    const row: Record<string, unknown> = {
      name: parseText(cell(cells, "name")) ?? "",
      sku: parseText(cell(cells, "sku")),
      barcode: parseText(cell(cells, "barcode")),
      category: parseText(cell(cells, "category")),
      unit: parseText(cell(cells, "unit")),
      price: parseNumber(cell(cells, "price")),
      cost: parseNumber(cell(cells, "cost")),
      taxRate: parseTaxRate(cell(cells, "taxRate")),
      initialStock: parseNumber(cell(cells, "initialStock")),
      minStock: parseNumber(cell(cells, "minStock")),
    };
    // undefined no viaja en JSON (campo opcional ausente); null si, y la API lo marca invalido.
    return row;
  });
  return { rows, rowNumbers: sheet.rows.map((r) => r.rowNumber) };
}

export async function downloadTemplate() {
  const XLSX = await loadXlsx();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Nombre", "Referencia", "Codigo de barras", "Precio de venta", "Costo", "IVA", "Categoria", "Stock inicial", "Stock minimo", "Unidad"],
    ["Gaseosa 400 ml", "GAS-400", "7702004003508", 3000, 1800, 19, "Bebidas", 24, 6, "UN"],
    ["Pan tajado", "", "", 5500, 3900, 5, "Panaderia", 10, 2, "UN"],
  ]);
  sheet["!cols"] = [28, 14, 18, 16, 12, 8, 16, 14, 14, 10].map((wch) => ({ wch }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Productos");
  XLSX.writeFile(workbook, "plantilla-productos-contapro.xlsx");
}
