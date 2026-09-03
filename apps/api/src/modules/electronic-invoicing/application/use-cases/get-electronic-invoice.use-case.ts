import { NotFoundError } from "../../../../shared/errors/app-error";
import type { ElectronicInvoiceWithXml, IElectronicInvoiceRepository } from "../../domain/electronic-invoice.repository";

export type GetElectronicInvoiceQuery = { type: "sale"; id: string } | { type: "manual"; id: string };

export class GetElectronicInvoiceUseCase {
  constructor(private readonly repo: IElectronicInvoiceRepository) {}

  async execute(query: GetElectronicInvoiceQuery): Promise<ElectronicInvoiceWithXml> {
    const invoice =
      query.type === "sale" ? await this.repo.findBySaleId(query.id) : await this.repo.findByManualInvoiceId(query.id);
    if (!invoice) throw new NotFoundError("ElectronicInvoice", query.id);
    return invoice;
  }
}
