import { NotFoundError } from "../../../../shared/errors/app-error";
import type { ElectronicDebitNoteWithXml, IElectronicDebitNoteRepository } from "../../domain/electronic-debit-note.repository";

export class GetElectronicDebitNoteUseCase {
  constructor(private readonly repo: IElectronicDebitNoteRepository) {}

  async execute(debitNoteId: string): Promise<ElectronicDebitNoteWithXml> {
    const note = await this.repo.findByDebitNoteId(debitNoteId);
    if (!note) throw new NotFoundError("ElectronicDebitNote", debitNoteId);
    return note;
  }
}
