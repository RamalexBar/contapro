import { getTenantContext } from "../../../../../shared/context/request-context";
import type { AuditService } from "../../../../audit/application/audit.service";
import type { IStockRepository } from "../../domain/stock.repository";

export interface TransferStockInput {
  productId: string;
  fromBranchId: string;
  toBranchId: string;
  quantity: number;
}

export class TransferStockUseCase {
  constructor(private readonly repo: IStockRepository, private readonly audit: AuditService) {}

  async execute(input: TransferStockInput): Promise<void> {
    const userId = getTenantContext().userId;
    await this.repo.transfer(input.productId, input.fromBranchId, input.toBranchId, input.quantity, userId);
    await this.audit.record({
      action: "STOCK_ADJUSTED",
      entityType: "Product",
      entityId: input.productId,
      description: `Transferencia de ${input.quantity} unidades de sucursal ${input.fromBranchId} a ${input.toBranchId}`,
    });
  }
}
