import { NotFoundError } from "../../../../shared/errors/app-error";
import type {
  ElectronicSupportDocumentWithXml,
  IElectronicSupportDocumentRepository,
} from "../../domain/electronic-support-document.repository";

export class GetElectronicSupportDocumentUseCase {
  constructor(private readonly repo: IElectronicSupportDocumentRepository) {}

  async execute(purchaseId: string): Promise<ElectronicSupportDocumentWithXml> {
    const doc = await this.repo.findByPurchaseId(purchaseId);
    if (!doc) throw new NotFoundError("ElectronicSupportDocument", purchaseId);
    return doc;
  }
}
