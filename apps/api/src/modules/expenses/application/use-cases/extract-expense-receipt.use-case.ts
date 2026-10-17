import type { DocumentFileInput } from "../../../../shared/ai/document-file";
import type { IExpenseCategoryRepository } from "../../domain/expense-category.repository";
import type { ExtractedExpenseReceipt, IReceiptExtractionService } from "../../domain/receipt-extraction.port";

export interface ExtractExpenseReceiptResult {
  extracted: ExtractedExpenseReceipt;
  /** Categoria activa de la empresa sugerida por el lector; null si no eligio ninguna valida. */
  suggestedCategory: { id: string; name: string } | null;
  /** IVA en % calculado de subtotal y taxTotal (el formulario pide el %), redondeado. */
  taxRatePercent: number | null;
}

/**
 * Lee la foto o PDF del soporte de un gasto y arma un borrador para el formulario "Registrar
 * gasto". Le pasa al lector las categorias activas de la empresa para que sugiera una. Nunca
 * registra el gasto: eso lo hace el usuario con POST /expenses despues de revisar.
 */
export class ExtractExpenseReceiptUseCase {
  constructor(
    private readonly extractionService: IReceiptExtractionService,
    private readonly categoryRepo: IExpenseCategoryRepository
  ) {}

  async execute(file: DocumentFileInput): Promise<ExtractExpenseReceiptResult> {
    const categories = (await this.categoryRepo.list()).filter((c) => c.isActive);
    const extracted = await this.extractionService.extract(
      file,
      categories.map((c) => ({ code: c.code, name: c.name }))
    );

    const category = extracted.categoryCode ? categories.find((c) => c.code === extracted.categoryCode) : undefined;
    const taxRatePercent =
      extracted.subtotal && extracted.subtotal > 0 && extracted.taxTotal != null
        ? Math.round((extracted.taxTotal / extracted.subtotal) * 100)
        : null;

    return {
      extracted,
      suggestedCategory: category ? { id: category.id, name: category.name } : null,
      taxRatePercent,
    };
  }
}
