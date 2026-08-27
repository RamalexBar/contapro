import type { ISupplierRepository, SupplierRecord } from "../../domain/supplier.repository";
import type { ExtractedPurchaseInvoice, IInvoiceExtractionService, InvoiceFileInput } from "../../domain/invoice-extraction.port";

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
    private readonly supplierRepo: ISupplierRepository
  ) {}

  async execute(file: InvoiceFileInput): Promise<ExtractPurchaseInvoiceResult> {
    const extracted = await this.extractionService.extract(file);

    const matchedSupplier = await this.matchSupplier(extracted);

    const suggestedDueDate = extracted.issueDate ? addDays(extracted.issueDate, DEFAULT_PAYMENT_TERM_DAYS) : null;

    return { extracted, matchedSupplier, suggestedDueDate };
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
