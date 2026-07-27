import type { DebitNoteRecord, IDebitNoteRepository } from "../../domain/debit-note.repository";

export class ListDebitNotesUseCase {
  constructor(private readonly repo: IDebitNoteRepository) {}
  async execute(): Promise<DebitNoteRecord[]> {
    return this.repo.list();
  }
}
