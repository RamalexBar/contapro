import {
  createColumnMatcher,
  downloadWorkbook,
  normalizeHeader,
  parseText,
  readSpreadsheet,
  type ColumnMapping as GenericColumnMapping,
  type ParsedSheet,
} from "../../../lib/spreadsheet";

/** Importacion masiva de productos: plantilla propia o exportacion de Alegra/Siigo (ver lib/spreadsheet). */

export type { ParsedSheet };

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
 * elige a mano).
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

const matcher = createColumnMatcher(
  IMPORT_FIELDS.map((f) => f.field),
  ALIASES
);

export type ColumnMapping = GenericColumnMapping<ImportField>;
export const detectMapping = matcher.detectMapping;
export const readProductSpreadsheet = (file: File) => readSpreadsheet(file, matcher.isKnownHeader);

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

/** Arma las filas que espera POST /products/import segun el mapeo de columnas elegido. */
export function buildImportRows(sheet: ParsedSheet, mapping: ColumnMapping) {
  const cell = (cells: unknown[], field: ImportField) => (mapping[field] >= 0 ? cells[mapping[field]] : undefined);
  const rows = sheet.rows.map(({ cells }) => {
    // undefined no viaja en JSON (campo opcional ausente); null si, y la API lo marca invalido.
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
    return row;
  });
  return { rows, rowNumbers: sheet.rows.map((r) => r.rowNumber) };
}

export function downloadTemplate() {
  return downloadWorkbook(
    "plantilla-productos-contapro.xlsx",
    "Productos",
    [
      ["Nombre", "Referencia", "Codigo de barras", "Precio de venta", "Costo", "IVA", "Categoria", "Stock inicial", "Stock minimo", "Unidad"],
      ["Gaseosa 400 ml", "GAS-400", "7702004003508", 3000, 1800, 19, "Bebidas", 24, 6, "UN"],
      ["Pan tajado", "", "", 5500, 3900, 5, "Panaderia", 10, 2, "UN"],
    ],
    [28, 14, 18, 16, 12, 8, 16, 14, 14, 10]
  );
}
