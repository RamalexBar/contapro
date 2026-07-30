import { NotFoundError } from "../../../../shared/errors/app-error";
import type { ElectronicCreditNoteWithXml, IElectronicCreditNoteRepository } from "../../domain/electronic-credit-note.repository";

export class GetElectronicCreditNoteUseCase {
  constructor(private readonly repo: IElectronicCreditNoteRepository) {}

  async execute(creditNoteId: string): Promise<ElectronicCreditNoteWithXml> {
    const note = await this.repo.findByCreditNoteId(creditNoteId);
    if (!note) throw new NotFoundError("ElectronicCreditNote", creditNoteId);
    return note;
  }
}
