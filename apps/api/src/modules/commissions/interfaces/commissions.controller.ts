import type { NextFunction, Request, Response } from "express";
import { basePrisma } from "@erp/database";
import { formatCOP } from "@erp/shared-utils";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import { renderSimpleDocumentPdf } from "../../../shared/pdf/simple-document-renderer";
import {
  calculateCommissionsSchema,
  createSalesCommissionSchemeSchema,
  payCommissionSettlementSchema,
  updateSalesCommissionSchemeSchema,
} from "./commissions.validators";
import type { CreateSalesCommissionSchemeUseCase } from "../application/use-cases/create-sales-commission-scheme.use-case";
import type { UpdateSalesCommissionSchemeUseCase } from "../application/use-cases/update-sales-commission-scheme.use-case";
import type { DeactivateSalesCommissionSchemeUseCase } from "../application/use-cases/deactivate-sales-commission-scheme.use-case";
import type { ListSalesCommissionSchemesUseCase } from "../application/use-cases/list-sales-commission-schemes.use-case";
import type { ListSellersUseCase } from "../application/use-cases/list-sellers.use-case";
import type { CalculateCommissionsUseCase } from "../application/use-cases/calculate-commissions.use-case";
import type { ListCommissionSettlementsUseCase } from "../application/use-cases/list-commission-settlements.use-case";
import type { PayCommissionSettlementUseCase } from "../application/use-cases/pay-commission-settlement.use-case";
import type { CommissionSettlementStatus, ICommissionSettlementRepository } from "../domain/commission-settlement.repository";
import type { IUserDirectoryRepository } from "../../rbac/domain/rbac.types";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export class CommissionsController {
  constructor(
    private readonly createSchemeUseCase: CreateSalesCommissionSchemeUseCase,
    private readonly updateSchemeUseCase: UpdateSalesCommissionSchemeUseCase,
    private readonly deactivateSchemeUseCase: DeactivateSalesCommissionSchemeUseCase,
    private readonly listSchemesUseCase: ListSalesCommissionSchemesUseCase,
    private readonly listSellersUseCase: ListSellersUseCase,
    private readonly calculateUseCase: CalculateCommissionsUseCase,
    private readonly listSettlementsUseCase: ListCommissionSettlementsUseCase,
    private readonly payUseCase: PayCommissionSettlementUseCase,
    private readonly settlementRepo: ICommissionSettlementRepository,
    private readonly userDirectoryRepo: IUserDirectoryRepository
  ) {}

  listSchemes = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listSchemesUseCase.execute() });
    } catch (err) {
      next(err);
    }
  };

  createScheme = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createSalesCommissionSchemeSchema.parse(req.body);
      res.status(201).json(await this.createSchemeUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  updateScheme = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateSalesCommissionSchemeSchema.parse(req.body);
      res.json(await this.updateSchemeUseCase.execute(req.params.id, body));
    } catch (err) {
      next(err);
    }
  };

  deactivateScheme = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.deactivateSchemeUseCase.execute(req.params.id));
    } catch (err) {
      next(err);
    }
  };

  listSellers = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listSellersUseCase.execute() });
    } catch (err) {
      next(err);
    }
  };

  calculate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = calculateCommissionsSchema.parse(req.body);
      res.json({ data: await this.calculateUseCase.execute(body.year, body.month) });
    } catch (err) {
      next(err);
    }
  };

  listSettlements = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const year = typeof req.query.year === "string" ? Number(req.query.year) : undefined;
      const month = typeof req.query.month === "string" ? Number(req.query.month) : undefined;
      const status = typeof req.query.status === "string" ? (req.query.status as CommissionSettlementStatus) : undefined;
      res.json({ data: await this.listSettlementsUseCase.execute({ year, month, status }) });
    } catch (err) {
      next(err);
    }
  };

  pay = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = payCommissionSettlementSchema.parse(req.body);
      res.json(await this.payUseCase.execute({ id: req.params.id, ...body }));
    } catch (err) {
      next(err);
    }
  };

  getSettlementPdf = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settlement = await this.settlementRepo.findByIdOrThrow(req.params.id);
      const [company, sellers] = await Promise.all([
        basePrisma.company.findFirst({ where: { id: getTenantContext().companyId } }),
        this.userDirectoryRepo.list(),
      ]);
      if (!company) throw new NotFoundError("Company", getTenantContext().companyId);
      const sellerName = sellers.find((s) => s.id === settlement.sellerUserId)?.fullName ?? "(vendedor no encontrado)";

      const pdf = await renderSimpleDocumentPdf({
        company: { name: company.name, nit: company.nit },
        title: "Liquidacion de comisiones",
        fields: [
          { label: "Vendedor", value: sellerName },
          { label: "Periodo", value: `${MONTH_NAMES[settlement.month - 1]} ${settlement.year}` },
          { label: "Base de ventas", value: formatCOP(settlement.salesBase) },
          { label: "Tarifa", value: `${settlement.ratePercent}%` },
          { label: "Estado", value: settlement.status === "PAID" ? "Pagada" : "Calculada" },
        ],
        totalLabel: "Comision a pagar",
        total: formatCOP(settlement.commissionAmount),
        generatedAt: new Date(),
      });
      res.type("application/pdf").send(pdf);
    } catch (err) {
      next(err);
    }
  };
}
