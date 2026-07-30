import { NotFoundError } from "../../../../shared/errors/app-error";
import type { ElectronicInvoiceWithXml, IElectronicInvoiceRepository } from "../../domain/electronic-invoice.repository";

export class GetElectronicInvoiceUseCase {
  constructor(private readonly repo: IElectronicInvoiceRepository) {}

  async execute(saleId: string): Promise<ElectronicInvoiceWithXml> {
    const invoice = await this.repo.findBySaleId(saleId);
    if (!invoice) throw new NotFoundError("ElectronicInvoice", saleId);
    return invoice;
  }
}
