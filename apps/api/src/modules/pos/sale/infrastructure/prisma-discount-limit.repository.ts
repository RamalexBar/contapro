import { prisma } from "../../../../shared/prisma/prisma-client";
import type { IDiscountLimitRepository } from "../domain/discount-limit.repository";

export class PrismaDiscountLimitRepository implements IDiscountLimitRepository {
  async getMaxDiscountPercent(userId: string): Promise<number | null> {
    const record = await prisma.cashierDiscountLimit.findFirst({ where: { userId } });
    return record ? Number(record.maxDiscountPercent) : null;
  }
}
