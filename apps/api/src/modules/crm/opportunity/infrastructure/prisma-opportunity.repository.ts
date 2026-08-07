import { applyDiscount, calculateTax, round2 } from "@erp/shared-utils";
import { prisma } from "../../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../../shared/context/request-context";
import { NotFoundError } from "../../../../shared/errors/app-error";
import type {
  CreateOpportunityData,
  IOpportunityRepository,
  OpportunityItemRecord,
  OpportunityListFilter,
  OpportunityRecord,
  UpdateOpportunityStageData,
} from "../domain/opportunity.repository";

const INCLUDE = { items: true } as const;

type OpportunityRow = {
  id: string;
  branchId: string;
  customerId: string;
  ownerUserId: string;
  title: string;
  description: string | null;
  stage: string;
  expectedValue: unknown;
  expectedCloseDate: Date | null;
  lostReason: string | null;
  wonAt: Date | null;
  lostAt: Date | null;
  saleId: string | null;
  createdAt: Date;
  items: Array<{
    id: string;
    productId: string;
    quantity: unknown;
    unitPrice: unknown;
    discountPercent: unknown;
    total: unknown;
  }>;
};

function toItemRecord(item: OpportunityRow["items"][number]): OpportunityItemRecord {
  return {
    id: item.id,
    productId: item.productId,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    discountPercent: Number(item.discountPercent),
    total: Number(item.total),
  };
}

function toRecord(row: OpportunityRow): OpportunityRecord {
  return {
    id: row.id,
    branchId: row.branchId,
    customerId: row.customerId,
    ownerUserId: row.ownerUserId,
    title: row.title,
    description: row.description,
    stage: row.stage,
    expectedValue: Number(row.expectedValue),
    expectedCloseDate: row.expectedCloseDate,
    lostReason: row.lostReason,
    wonAt: row.wonAt,
    lostAt: row.lostAt,
    saleId: row.saleId,
    items: row.items.map(toItemRecord),
    createdAt: row.createdAt,
  };
}

export class PrismaOpportunityRepository implements IOpportunityRepository {
  async create(data: CreateOpportunityData): Promise<OpportunityRecord> {
    // expectedValue debe representar lo que el cliente realmente pagaria (incluido IVA) -- no
    // solo el subtotal negociado -- porque CloseOpportunityAsWonUseCase lo usa directo como monto
    // del pago CREDIT que se le pasa a CreateSaleUseCase, y ese exige cubrir el neto CON impuesto.
    // Por eso, a diferencia de PrismaQuoteRepository (que no calcula impuesto porque Quote nunca
    // se convierte en Sale), aqui SI se busca el producto para tomar su taxRate vigente (el precio
    // en si es el negociado por el usuario, no el del catalogo).
    let expectedValue = 0;
    const itemsData = [];
    for (const item of data.items) {
      const product = await prisma.product.findFirst({ where: { id: item.productId } });
      const taxRate = Number(product?.taxRate ?? 0);
      const lineSubtotal = round2(item.unitPrice * item.quantity);
      const discountedSubtotal = applyDiscount(lineSubtotal, item.discountPercent);
      const taxAmount = calculateTax(discountedSubtotal, taxRate);
      const lineTotal = round2(discountedSubtotal + taxAmount);
      expectedValue = round2(expectedValue + lineTotal);
      itemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        total: lineTotal,
      });
    }

    const row = await prisma.opportunity.create({
      data: {
        companyId: getTenantContext().companyId,
        branchId: data.branchId,
        customerId: data.customerId,
        ownerUserId: data.ownerUserId,
        title: data.title,
        description: data.description,
        expectedCloseDate: data.expectedCloseDate,
        expectedValue,
        items: { create: itemsData },
      },
      include: INCLUDE,
    });
    return toRecord(row);
  }

  async list(filter?: OpportunityListFilter): Promise<OpportunityRecord[]> {
    const rows = await prisma.opportunity.findMany({
      where: {
        stage: filter?.stage,
        customerId: filter?.customerId,
      },
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toRecord);
  }

  async findByIdOrThrow(id: string): Promise<OpportunityRecord> {
    const row = await prisma.opportunity.findFirst({ where: { id }, include: INCLUDE });
    if (!row) throw new NotFoundError("Opportunity", id);
    return toRecord(row);
  }

  async updateStage(id: string, data: UpdateOpportunityStageData): Promise<OpportunityRecord> {
    // update() por id no queda cubierto por la extension de tenant (ver tenant.extension.ts) --
    // findByIdOrThrow confirma primero que la oportunidad pertenece al tenant actual.
    await this.findByIdOrThrow(id);
    const row = await prisma.opportunity.update({
      where: { id },
      data: {
        stage: data.stage,
        lostReason: data.lostReason,
        wonAt: data.wonAt,
        lostAt: data.lostAt,
        saleId: data.saleId,
      },
      include: INCLUDE,
    });
    return toRecord(row);
  }
}
