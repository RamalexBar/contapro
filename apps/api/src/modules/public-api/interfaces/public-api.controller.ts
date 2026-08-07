import type { NextFunction, Request, Response } from "express";
import { createSaleSchema } from "@erp/shared-types";
import { createCustomerSchema } from "../../customers/interfaces/customer.validators";
import type { IProductRepository } from "../../inventory/product/domain/product.repository";
import type { ICustomerRepository } from "../../customers/domain/customer.repository";
import type { ISaleRepository } from "../../pos/sale/domain/sale.repository";
import type { CreateSaleUseCase } from "../../pos/sale/application/use-cases/create-sale.use-case";

/**
 * Controlador de la API publica (item 40 de docs/ALCANCE.md, `/api/public/v1/*`): solo
 * controladores delgados sobre repositorios/casos de uso YA existentes, sin logica de negocio
 * nueva. Autenticado por API key (`apiKeyAuthMiddleware`), no por JWT -- ver ese middleware para
 * como puebla el mismo tenantStorage que el resto del sistema.
 */
export class PublicApiController {
  constructor(
    private readonly productRepo: IProductRepository,
    private readonly customerRepo: ICustomerRepository,
    private readonly saleRepo: ISaleRepository,
    private readonly createSaleUseCase: CreateSaleUseCase
  ) {}

  listProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      res.json({ data: await this.productRepo.list(search) });
    } catch (err) {
      next(err);
    }
  };

  getProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await this.productRepo.findByIdOrThrow(req.params.id);
      res.json(product.toProps);
    } catch (err) {
      next(err);
    }
  };

  listCustomers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      res.json({ data: await this.customerRepo.list(search) });
    } catch (err) {
      next(err);
    }
  };

  createCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createCustomerSchema.parse(req.body);
      res.status(201).json(await this.customerRepo.create(body));
    } catch (err) {
      next(err);
    }
  };

  listSales = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const take = typeof req.query.take === "string" ? Number(req.query.take) : undefined;
      const skip = typeof req.query.skip === "string" ? Number(req.query.skip) : undefined;
      res.json({ data: await this.saleRepo.list({ take, skip }) });
    } catch (err) {
      next(err);
    }
  };

  createSale = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createSaleSchema.parse(req.body);
      res.status(201).json(await this.createSaleUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };
}
