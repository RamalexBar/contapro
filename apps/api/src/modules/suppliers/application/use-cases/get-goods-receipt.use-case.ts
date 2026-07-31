import type { GoodsReceiptRecord, IGoodsReceiptRepository } from "../../domain/goods-receipt.repository";

export class GetGoodsReceiptUseCase {
  constructor(private readonly repo: IGoodsReceiptRepository) {}

  execute(id: string): Promise<GoodsReceiptRecord> {
    return this.repo.findByIdOrThrow(id);
  }
}
