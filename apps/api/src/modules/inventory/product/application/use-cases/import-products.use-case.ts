import {
  importProductRowSchema,
  type ImportProductRow,
  type ImportProductsInput,
  type ImportProductsResult,
  type ImportProductsRowError,
} from "@erp/shared-types";
import type { ICategoryRepository } from "../../../category/domain/category.repository";
import type { IProductRepository } from "../../domain/product.repository";
import type { CreateProductUseCase } from "./create-product.use-case";
import { createSkuSequence, normalizeSkuKey as normalizeKey } from "../sku-sequence";

const DEFAULT_TAX_RATE = 19;
/** Fila 1 del Excel es el encabezado, asi que el primer producto es la fila 2. */
const FIRST_DATA_ROW = 2;

interface PreparedRow {
  rowNumber: number;
  data: ImportProductRow;
  sku: string;
}

/**
 * Carga masiva de productos (Excel/CSV leido en el navegador, o exportacion de Alegra/Siigo).
 *
 * Todo o nada a nivel de validacion: si una sola fila tiene error, no se crea ningun producto y se
 * devuelve la lista completa de errores por fila, para que el usuario corrija el archivo y lo vuelva
 * a subir sin quedar con medio catalogo cargado. `dryRun` hace solo esa validacion (vista previa).
 *
 * Cada producto se crea con `CreateProductUseCase` -- el mismo caso de uso del alta manual --, asi
 * el stock inicial, el kardex y la auditoria por producto salen identicos a crearlo a mano.
 */
export class ImportProductsUseCase {
  constructor(
    private readonly productRepo: IProductRepository,
    private readonly categoryRepo: ICategoryRepository,
    private readonly createProduct: CreateProductUseCase
  ) {}

  async execute(input: ImportProductsInput, branchId: string): Promise<ImportProductsResult> {
    const errors: ImportProductsRowError[] = [];
    const taken = await this.productRepo.listTakenIdentifiers();
    const takenSkus = new Set(taken.skus.map(normalizeKey));
    const takenBarcodes = new Set(taken.barcodes.map(normalizeKey));
    const fileSkus = new Map<string, number>();
    const fileBarcodes = new Map<string, number>();

    const valid: { rowNumber: number; data: ImportProductRow }[] = [];
    input.rows.forEach((raw, index) => {
      const rowNumber = input.rowNumbers?.[index] ?? index + FIRST_DATA_ROW;
      const parsed = importProductRowSchema.safeParse(raw);
      const messages = parsed.success ? [] : parsed.error.issues.map((i) => i.message);

      // Los duplicados se revisan aunque la fila tenga otros errores, para que el usuario vea todos
      // los problemas de la fila de una vez y no tenga que subir el archivo varias veces.
      const fields = (raw ?? {}) as { sku?: unknown; barcode?: unknown };
      const sku = typeof fields.sku === "string" ? fields.sku.trim() : "";
      const barcode = typeof fields.barcode === "string" ? fields.barcode.trim() : "";
      if (sku) {
        const key = normalizeKey(sku);
        if (takenSkus.has(key)) messages.push(`La referencia "${sku}" ya existe en el sistema`);
        const firstRow = fileSkus.get(key);
        if (firstRow !== undefined) messages.push(`La referencia "${sku}" esta repetida (fila ${firstRow})`);
        else fileSkus.set(key, rowNumber);
      }
      if (barcode) {
        const key = normalizeKey(barcode);
        if (takenBarcodes.has(key)) messages.push(`El codigo de barras "${barcode}" ya existe en el sistema`);
        const firstRow = fileBarcodes.get(key);
        if (firstRow !== undefined) messages.push(`El codigo de barras "${barcode}" esta repetido (fila ${firstRow})`);
        else fileBarcodes.set(key, rowNumber);
      }

      if (!parsed.success || messages.length > 0) errors.push({ rowNumber, messages });
      else valid.push({ rowNumber, data: parsed.data });
    });

    // Las referencias generadas no deben chocar ni con el sistema ni con las que si trae el archivo.
    const nextSku = createSkuSequence([...takenSkus, ...fileSkus.keys()]);
    const prepared: PreparedRow[] = valid.map((v) => ({ ...v, sku: v.data.sku ?? nextSku() }));

    const existingCategories = await this.categoryRepo.list();
    const categoryIdByName = new Map(existingCategories.map((c) => [normalizeKey(c.name), c.id]));
    const missingCategories = new Map<string, string>();
    for (const { data } of prepared) {
      const key = data.category ? normalizeKey(data.category) : undefined;
      // La primera forma en que aparece escrita en el archivo es la que queda como nombre.
      if (data.category && key && !categoryIdByName.has(key) && !missingCategories.has(key)) {
        missingCategories.set(key, data.category);
      }
    }

    const result: ImportProductsResult = {
      dryRun: input.dryRun,
      totalRows: input.rows.length,
      validRows: prepared.length,
      created: 0,
      categoriesCreated: [...missingCategories.values()],
      errors: sortByRow(errors),
    };
    if (input.dryRun || errors.length > 0) {
      if (errors.length > 0) result.categoriesCreated = [];
      return result;
    }

    for (const [key, name] of missingCategories) {
      const category = await this.categoryRepo.create(name);
      categoryIdByName.set(key, category.id);
    }

    // Validado todo arriba; si aun asi una fila falla al crear (ej. otro usuario creo esa misma
    // referencia entre la validacion y este punto), se reporta y se sigue con las demas.
    for (const row of prepared) {
      const { data } = row;
      const taxRate = data.taxRate ?? DEFAULT_TAX_RATE;
      try {
        await this.createProduct.execute(
          {
            sku: row.sku,
            name: data.name,
            unit: data.unit ?? "UN",
            categoryId: data.category ? categoryIdByName.get(normalizeKey(data.category)) : undefined,
            currentPrice: input.pricesIncludeTax ? round2(data.price / (1 + taxRate / 100)) : data.price,
            currentCost: data.cost ?? 0,
            taxRate,
            barcode: data.barcode,
            initialStock: data.initialStock ?? 0,
            minStock: data.minStock ?? 0,
            maxStock: 0,
          },
          branchId
        );
        result.created += 1;
      } catch (err) {
        errors.push({ rowNumber: row.rowNumber, messages: [err instanceof Error ? err.message : "No se pudo crear el producto"] });
      }
    }
    result.errors = sortByRow(errors);
    return result;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function sortByRow(errors: ImportProductsRowError[]): ImportProductsRowError[] {
  return [...errors].sort((a, b) => a.rowNumber - b.rowNumber);
}
