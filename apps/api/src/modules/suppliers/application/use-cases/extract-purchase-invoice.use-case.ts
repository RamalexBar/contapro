import type { ISupplierRepository, SupplierRecord } from "../../domain/supplier.repository";
import type {
  ExtractedInvoiceLine,
  ExtractedPurchaseInvoice,
  IInvoiceExtractionService,
  InvoiceFileInput,
} from "../../domain/invoice-extraction.port";
import type { IProductRepository } from "../../../inventory/product/domain/product.repository";

export interface MatchedProduct {
  id: string;
  name: string;
  sku: string;
}

export type ExtractedInvoiceLineWithMatch = ExtractedInvoiceLine & {
  /** Producto de Contapro que probablemente es este renglon -- null si no hay uno confiable. */
  matchedProduct: MatchedProduct | null;
};

const DEFAULT_PAYMENT_TERM_DAYS = 30;

export interface ExtractPurchaseInvoiceResult {
  extracted: ExtractedPurchaseInvoice;
  /** Proveedor ya existente que probablemente corresponde a la factura -- null si no hay ningun
   * candidato confiable (el usuario elige a mano en el formulario, como hoy). Nunca crea un
   * proveedor nuevo por su cuenta. */
  matchedSupplier: Pick<SupplierRecord, "id" | "name" | "nit"> | null;
  /** issueDate + 30 dias (mismo plazo por defecto que create-purchase.use-case.ts/
   * collections), null si no se pudo leer la fecha de emision. Solo una sugerencia editable. */
  suggestedDueDate: string | null;
  /** Renglones de la factura con el producto de Contapro sugerido para cada uno. */
  lines: ExtractedInvoiceLineWithMatch[];
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNit(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

/**
 * Lee una foto o PDF de factura de compra (via IInvoiceExtractionService, ver
 * claude-invoice-extraction.service.ts) y arma un borrador para precargar el formulario de
 * "Registrar factura de compra" -- nunca crea el Purchase, eso lo sigue haciendo el usuario con
 * POST /purchases (CreatePurchaseUseCase) despues de revisar/corregir lo que salga aca. Intenta
 * emparejar con un proveedor ya existente por NIT (exacto) o por nombre (solo si hay un unico
 * resultado, para no adivinar entre varios).
 */
export class ExtractPurchaseInvoiceUseCase {
  constructor(
    private readonly extractionService: IInvoiceExtractionService,
    private readonly supplierRepo: ISupplierRepository,
    private readonly productRepo: IProductRepository
  ) {}

  async execute(file: InvoiceFileInput): Promise<ExtractPurchaseInvoiceResult> {
    const extracted = await this.extractionService.extract(file);

    const matchedSupplier = await this.matchSupplier(extracted);

    const suggestedDueDate = extracted.issueDate ? addDays(extracted.issueDate, DEFAULT_PAYMENT_TERM_DAYS) : null;

    const lines: ExtractedInvoiceLineWithMatch[] = [];
    for (const line of extracted.items) {
      lines.push({ ...line, matchedProduct: await this.matchProduct(line) });
    }

    return { extracted, matchedSupplier, suggestedDueDate, lines };
  }

  /**
   * Codigo de barras exacto primero; si no, por nombre: el que se llame igual (sin tildes ni
   * mayusculas) o el unico que contenga la descripcion. Con varios candidatos no se adivina.
   */
  private async matchProduct(line: ExtractedInvoiceLine): Promise<MatchedProduct | null> {
    const code = line.code?.replace(/\s/g, "");
    if (code) {
      const byBarcode = await this.productRepo.findByBarcode(code);
      if (byBarcode) {
        const props = byBarcode.toProps;
        return { id: props.id, name: props.name, sku: props.sku };
      }
    }

    const description = line.description.trim();
    if (description.length < 3) return null;
    const candidates = await this.productRepo.list(description);
    const target = normalizeName(description);
    const exact = candidates.find((c) => normalizeName(c.name) === target);
    const match = exact ?? (candidates.length === 1 ? candidates[0] : undefined);
    return match ? { id: match.id, name: match.name, sku: match.sku } : null;
  }

  private async matchSupplier(extracted: ExtractedPurchaseInvoice): Promise<Pick<SupplierRecord, "id" | "name" | "nit"> | null> {
    if (extracted.supplierNit) {
      const targetNit = normalizeNit(extracted.supplierNit);
      if (targetNit) {
        const allSuppliers = await this.supplierRepo.list();
        const byNit = allSuppliers.find((s) => normalizeNit(s.nit) === targetNit);
        if (byNit) return byNit;
      }
    }

    if (extracted.supplierName) {
      const byName = await this.supplierRepo.list(extracted.supplierName);
      // Solo si es inequivoco -- con varios resultados no hay forma confiable de elegir uno solo.
      if (byName.length === 1) return byName[0];
    }

    return null;
  }
}

function addDays(isoDate: string, days: number): string | null {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
