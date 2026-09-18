import type { ExtractedBankStatement, IStatementExtractionService, StatementFileInput } from "../../domain/statement-extraction.port";

/**
 * Lee una foto o PDF de extracto bancario (via IStatementExtractionService, ver
 * claude-statement-extraction.service.ts) y devuelve el borrador de movimientos para que el
 * usuario los revise, deseleccione los que no correspondan y confirme -- nunca crea ningun
 * BankTransaction, eso lo sigue haciendo el usuario con POST /bank-accounts/:id/transactions
 * (RegisterBankTransactionUseCase) por cada movimiento que confirme.
 */
export class ExtractBankStatementUseCase {
  constructor(private readonly extractionService: IStatementExtractionService) {}

  async execute(file: StatementFileInput): Promise<ExtractedBankStatement> {
    return this.extractionService.extract(file);
  }
}
