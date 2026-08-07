import { ValidationError } from "../../../../../shared/errors/app-error";
import type { AuditService } from "../../../../audit/application/audit.service";
import type { CreateSaleUseCase } from "../../../../pos/sale/application/use-cases/create-sale.use-case";
import type { SaleRecord } from "../../../../pos/sale/domain/sale.repository";
import type { IOpportunityRepository, OpportunityRecord } from "../../domain/opportunity.repository";
import { TERMINAL_STAGES } from "./update-stage.use-case";

export interface CloseOpportunityAsWonInput {
  opportunityId: string;
  paymentMethod?: "CASH" | "CREDIT";
}

export interface CloseOpportunityAsWonResult {
  opportunity: OpportunityRecord;
  sale: SaleRecord;
}

/**
 * "Cerrar como ganada" reusa CreateSaleUseCase (el mismo caso de uso que POST /sales) en vez de
 * duplicar logica de facturacion/cobro -- ver README del modulo. Con pago CREDIT (default),
 * CreateSaleUseCase ya crea automaticamente una AccountReceivable (item 31) y contabiliza.
 *
 * Limitaciones documentadas (no se toca CreateSaleUseCase, que es codigo compartido ya probado,
 * para evitar estas dos): (1) CreateSaleUseCase siempre re-cotiza los items al precio VIGENTE del
 * producto, no al OpportunityItem.unitPrice negociado -- si el precio del producto cambio, el
 * total facturado puede diferir de expectedValue. (2) CreateSaleUseCase toma sellerUserId de
 * quien hace la request, no de Opportunity.ownerUserId -- quien cierra queda como vendedor de la
 * venta, no necesariamente el dueño original de la oportunidad.
 */
export class CloseOpportunityAsWonUseCase {
  constructor(
    private readonly repo: IOpportunityRepository,
    private readonly createSaleUseCase: CreateSaleUseCase,
    private readonly audit: AuditService
  ) {}

  async execute(input: CloseOpportunityAsWonInput): Promise<CloseOpportunityAsWonResult> {
    const opportunity = await this.repo.findByIdOrThrow(input.opportunityId);

    if (TERMINAL_STAGES.includes(opportunity.stage)) {
      throw new ValidationError("Una oportunidad cerrada (ganada o perdida) no puede volver a cerrarse");
    }
    if (opportunity.items.length === 0) {
      throw new ValidationError("La oportunidad no tiene items, no se puede convertir en venta");
    }

    const method = input.paymentMethod ?? "CREDIT";
    const sale = await this.createSaleUseCase.execute({
      branchId: opportunity.branchId,
      customerId: opportunity.customerId,
      // Opportunity no tiene concepto de moneda (item 32) -- una oportunidad ganada siempre se
      // convierte en una venta COP (item 33 es multi-moneda solo para POS/compras directas).
      currency: "COP",
      exchangeRate: 1,
      items: opportunity.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        discountPercent: item.discountPercent,
      })),
      payments: [{ method, amount: opportunity.expectedValue }],
      withholdings: [],
      dueDate: opportunity.expectedCloseDate ?? undefined,
    });

    const updated = await this.repo.updateStage(opportunity.id, {
      stage: "GANADA",
      wonAt: new Date(),
      saleId: sale.id,
    });

    await this.audit.record({
      action: "OPPORTUNITY_WON",
      entityType: "Opportunity",
      entityId: opportunity.id,
      description: `Oportunidad "${opportunity.title}" ganada, convertida en venta #${sale.number}`,
      metadata: { saleId: sale.id, saleTotal: sale.total, saleStatus: sale.status },
    });

    return { opportunity: updated, sale };
  }
}
