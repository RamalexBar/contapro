/**
 * Lectura de Excel/CSV 100% en el navegador (SheetJS) para las importaciones masivas (productos,
 * plan de cuentas): el archivo nunca se sube, solo las filas ya mapeadas a JSON. SheetJS lee .xlsx,
 * el .xls viejo y .csv -- cubre las plantillas propias y las exportaciones de otros programas.
 */

// SheetJS pesa ~400 KB: se carga solo cuando alguien abre un importador, no en el bundle principal
// (que tambien sirve la landing publica).
const loadXlsx = () => import("xlsx");

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

/** Columna (indice) asignada a cada campo; -1 = sin asignar. */
export type ColumnMapping<F extends string> = Record<F, number>;

/**
 * Detector de columnas por alias. Los alias se comparan normalizados (minusculas, sin tildes ni
 * signos); gana el alias mas largo que coincida, y el modo exacto corre en todas las columnas antes
 * que el de "empieza con" -- asi "precio compra unitario" cae en costo ("precio compra") y no en
 * precio de venta ("precio").
 */
export function createColumnMatcher<F extends string>(fields: readonly F[], aliases: Record<F, string[]>) {
  function matchField(header: string, mode: "exact" | "prefix"): F | null {
    if (!header) return null;
    let best: { field: F; length: number } | null = null;
    for (const field of fields) {
      for (const alias of aliases[field]) {
        const hit = mode === "exact" ? header === alias : header === alias || header.startsWith(`${alias} `);
        if (hit && (!best || alias.length > best.length)) best = { field, length: alias.length };
      }
    }
    return best?.field ?? null;
  }

  function detectMapping(headers: string[]): ColumnMapping<F> {
    const mapping = Object.fromEntries(fields.map((f) => [f, -1])) as ColumnMapping<F>;
    const normalized = headers.map(normalizeHeader);
    for (const mode of ["exact", "prefix"] as const) {
      normalized.forEach((header, index) => {
        if (Object.values(mapping).includes(index)) return;
        const field = matchField(header, mode);
        if (field && mapping[field] === -1) mapping[field] = index;
      });
    }
    return mapping;
  }

  const isKnownHeader = (value: unknown) => matchField(normalizeHeader(value), "exact") !== null;
  return { detectMapping, isKnownHeader };
}

export async function readSpreadsheet(file: File, isKnownHeader: (value: unknown) => boolean): Promise<ParsedSheet> {
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
    if ((matrix[i] ?? []).filter(isKnownHeader).length >= 2) {
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

export function parseText(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text === "" ? undefined : text;
}

export async function downloadWorkbook(fileName: string, sheetName: string, rows: unknown[][], columnWidths: number[]) {
  const XLSX = await loadXlsx();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = columnWidths.map((wch) => ({ wch }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}
