import type { NextFunction, Request, Response } from "express";
import { getTenantContext } from "../../../../shared/context/request-context";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { CreateProductUseCase } from "../application/use-cases/create-product.use-case";
import type { UpdateProductUseCase } from "../application/use-cases/update-product.use-case";
import type { UpdateProductPriceUseCase } from "../application/use-cases/update-product-price.use-case";
import type { UpdateProductBarcodeUseCase } from "../application/use-cases/update-product-barcode.use-case";
import type { DeleteProductUseCase } from "../application/use-cases/delete-product.use-case";
import type { ListProductsUseCase } from "../application/use-cases/list-products.use-case";
import type { IProductRepository } from "../domain/product.repository";
import { toProductResponse } from "./product.mapper";
import {
  createProductSchema,
  updateProductBarcodeSchema,
  updateProductPriceSchema,
  updateProductSchema,
} from "./product.validators";

export class ProductController {
  constructor(
    private readonly productRepo: IProductRepository,
    private readonly createUseCase: CreateProductUseCase,
    private readonly updateUseCase: UpdateProductUseCase,
    private readonly updatePriceUseCase: UpdateProductPriceUseCase,
    private readonly updateBarcodeUseCase: UpdateProductBarcodeUseCase,
    private readonly deleteUseCase: DeleteProductUseCase,
    private readonly listUseCase: ListProductsUseCase
  ) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      res.json({ data: await this.listUseCase.execute(search) });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await this.productRepo.findByIdOrThrow(req.params.id);
      res.json(toProductResponse(product));
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createProductSchema.parse(req.body);
      const branchId = getTenantContext().branchId;
      if (!branchId) throw new ValidationError("El usuario no tiene una sucursal activa");
      const product = await this.createUseCase.execute(body, branchId);
      res.status(201).json(toProductResponse(product));
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateProductSchema.parse(req.body);
      const product = await this.updateUseCase.execute(req.params.id, body);
      res.json(toProductResponse(product));
    } catch (err) {
      next(err);
    }
  };

  /** Requiere permiso product.price.update / product.cost.update (ver product.routes.ts). */
  updatePrice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateProductPriceSchema.parse(req.body);
      const product = await this.updatePriceUseCase.execute({
        productId: req.params.id,
        newPrice: body.newPrice,
        newCost: body.newCost,
      });
      res.json(toProductResponse(product));
    } catch (err) {
      next(err);
    }
  };

  /** Requiere permiso product.barcode.update (ver product.routes.ts). */
  updateBarcode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateProductBarcodeSchema.parse(req.body);
      await this.updateBarcodeUseCase.execute(req.params.id, body.code, body.type);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  /** Requiere permiso product.delete (ver product.routes.ts). */
  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.deleteUseCase.execute(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
