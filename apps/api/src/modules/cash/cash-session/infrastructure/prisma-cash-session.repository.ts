import { prisma } from "../../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../../shared/context/request-context";
import { ConflictError, NotFoundError, ValidationError } from "../../../../shared/errors/app-error";
import type { CashSessionRecord, ICashSessionRepository } from "../domain/cash-session.repository";

const INFLOW_TYPES = new Set(["SALE_IN", "INCOME", "DEPOSIT"]);
const OUTFLOW_TYPES = new Set(["EXPENSE", "WITHDRAWAL"]);

function toRecord(row: {
  id: string;
  branchId: string;
  cashRegisterId: string;
  openedByUserId: string;
  closedByUserId: string | null;
  openingAmount: unknown;
  closingAmountExpected: unknown;
  closingAmountCounted: unknown;
  difference: unknown;
  status: string;
  openedAt: Date;
  closedAt: Date | null;
}): CashSessionRecord {
  return {
    id: row.id,
    branchId: row.branchId,
    cashRegisterId: row.cashRegisterId,
    openedByUserId: row.openedByUserId,
    closedByUserId: row.closedByUserId,
    openingAmount: Number(row.openingAmount),
    closingAmountExpected: row.closingAmountExpected !== null ? Number(row.closingAmountExpected) : null,
    closingAmountCounted: row.closingAmountCounted !== null ? Number(row.closingAmountCounted) : null,
    difference: row.difference !== null ? Number(row.difference) : null,
    status: row.status,
    openedAt: row.openedAt,
    closedAt: row.closedAt,
  };
}

export class PrismaCashSessionRepository implements ICashSessionRepository {
  async open(cashRegisterId: string, branchId: string, openingAmount: number, userId: string): Promise<CashSessionRecord> {
    const companyId = getTenantContext().companyId;

    const existing = await prisma.cashSession.findFirst({ where: { cashRegisterId, status: "OPEN" } });
    if (existing) throw new ConflictError("Esta caja ya tiene una sesion abierta");

    const row = await prisma.cashSession.create({
      data: { companyId, branchId, cashRegisterId, openedByUserId: userId, openingAmount },
    });
    return toRecord(row);
  }

  async findActiveByRegister(cashRegisterId: string): Promise<CashSessionRecord | null> {
    const row = await prisma.cashSession.findFirst({ where: { cashRegisterId, status: "OPEN" } });
    return row ? toRecord(row) : null;
  }

  async findByIdOrThrow(id: string): Promise<CashSessionRecord> {
    const row = await prisma.cashSession.findFirst({ where: { id } });
    if (!row) throw new NotFoundError("CashSession", id);
    return toRecord(row);
  }

  async close(
    id: string,
    closingAmountCounted: number,
    userId: string,
    notes?: string,
    counts?: Array<{ denomination: number; quantity: number }>
  ): Promise<CashSessionRecord> {
    const session = await this.findByIdOrThrow(id);
    if (session.status !== "OPEN") throw new ValidationError("La sesion de caja ya esta cerrada");

    const netMovements = await this.sumMovements(id);
    const closingAmountExpected = session.openingAmount + netMovements;
    const difference = closingAmountCounted - closingAmountExpected;

    const row = await prisma.$transaction(async (tx) => {
      if (counts && counts.length > 0) {
        await tx.cashCount.createMany({
          data: counts.map((c) => ({
            cashSessionId: id,
            denomination: c.denomination,
            quantity: c.quantity,
            subtotal: c.denomination * c.quantity,
          })),
        });
      }
      return tx.cashSession.update({
        where: { id },
        data: {
          status: "CLOSED",
          closedByUserId: userId,
          closedAt: new Date(),
          closingAmountExpected,
          closingAmountCounted,
          difference,
          notes,
        },
      });
    });
    return toRecord(row);
  }

  async registerMovement(cashSessionId: string, type: string, amount: number, concept: string, userId: string): Promise<{ id: string }> {
    const session = await this.findByIdOrThrow(cashSessionId);
    if (session.status !== "OPEN") throw new ValidationError("No se pueden registrar movimientos en una caja cerrada");
    const movement = await prisma.cashMovement.create({
      data: { cashSessionId, type, amount, concept, createdByUserId: userId },
    });
    return { id: movement.id };
  }

  async sumMovements(cashSessionId: string): Promise<number> {
    const movements = await prisma.cashMovement.findMany({ where: { cashSessionId } });
    let net = 0;
    for (const m of movements) {
      const amount = Number(m.amount);
      if (INFLOW_TYPES.has(m.type)) net += amount;
      else if (OUTFLOW_TYPES.has(m.type)) net -= amount;
    }
    return net;
  }

  async sumMovementsByType(from: Date, to: Date): Promise<Array<{ type: string; total: number }>> {
    const companyId = getTenantContext().companyId;
    const grouped = await prisma.cashMovement.groupBy({
      by: ["type"],
      where: { createdAt: { gte: from, lte: to }, cashSession: { companyId } },
      _sum: { amount: true },
    });
    return grouped.map((g) => ({ type: g.type, total: Number(g._sum.amount ?? 0) }));
  }
}
