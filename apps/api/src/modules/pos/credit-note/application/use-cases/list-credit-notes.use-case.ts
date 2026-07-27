import type { CreditNoteRecord, ICreditNoteRepository } from "../../domain/credit-note.repository";

export class ListCreditNotesUseCase {
  constructor(private readonly repo: ICreditNoteRepository) {}
  async execute(): Promise<CreditNoteRecord[]> {
    return this.repo.list();
  }
}
