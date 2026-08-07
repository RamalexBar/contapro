import type { NextFunction, Request, Response } from "express";
import { createPriceListSchema, setProductPriceSchema, updatePriceListSchema } from "./price-list.validators";
import type { CreatePriceListUseCase } from "../application/use-cases/create-price-list.use-case";
import type { UpdatePriceListUseCase } from "../application/use-cases/update-price-list.use-case";
import type { DeactivatePriceListUseCase } from "../application/use-cases/deactivate-price-list.use-case";
import type { ListPriceListsUseCase } from "../application/use-cases/list-price-lists.use-case";
import type { ListProductPricesUseCase } from "../application/use-cases/list-product-prices.use-case";
import type { SetProductPriceUseCase } from "../application/use-cases/set-product-price.use-case";
import type { RemoveProductPriceUseCase } from "../application/use-cases/remove-product-price.use-case";

export class PriceListController {
  constructor(
    private readonly createUseCase: CreatePriceListUseCase,
    private readonly updateUseCase: UpdatePriceListUseCase,
    private readonly deactivateUseCase: DeactivatePriceListUseCase,
    private readonly listUseCase: ListPriceListsUseCase,
    private readonly listProductPricesUseCase: ListProductPricesUseCase,
    private readonly setProductPriceUseCase: SetProductPriceUseCase,
    private readonly removeProductPriceUseCase: RemoveProductPriceUseCase
  ) {}

  list = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listUseCase.execute() });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createPriceListSchema.parse(req.body);
      res.status(201).json(await this.createUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updatePriceListSchema.parse(req.body);
      res.json(await this.updateUseCase.execute(req.params.id, body));
    } catch (err) {
      next(err);
    }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.deactivateUseCase.execute(req.params.id));
    } catch (err) {
      next(err);
    }
  };

  listProductPrices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listProductPricesUseCase.execute(req.params.id) });
    } catch (err) {
      next(err);
    }
  };

  setProductPrice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = setProductPriceSchema.parse(req.body);
      res.json(await this.setProductPriceUseCase.execute({ priceListId: req.params.id, productId: req.params.productId, ...body }));
    } catch (err) {
      next(err);
    }
  };

  removeProductPrice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.removeProductPriceUseCase.execute({ priceListId: req.params.id, productId: req.params.productId });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
