import type { GoodsReceiptRecord, IGoodsReceiptRepository } from "../../domain/goods-receipt.repository";

export class ListGoodsReceiptsUseCase {
  constructor(private readonly repo: IGoodsReceiptRepository) {}

  execute(): Promise<GoodsReceiptRecord[]> {
    return this.repo.list();
  }
}
