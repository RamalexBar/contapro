import type { NextFunction, Request, Response } from "express";
import type { RegisterStockEntryUseCase } from "../application/use-cases/register-stock-entry.use-case";
import type { AdjustStockUseCase } from "../application/use-cases/adjust-stock.use-case";
import type { TransferStockUseCase } from "../application/use-cases/transfer-stock.use-case";
import type { ListKardexUseCase } from "../application/use-cases/list-kardex.use-case";
import type { ListBranchStockUseCase } from "../application/use-cases/list-branch-stock.use-case";
import { listBranchStockQuerySchema, listKardexQuerySchema, stockAdjustSchema, stockEntrySchema, transferStockSchema } from "./stock.validators";

export class StockController {
  constructor(
    private readonly registerEntryUseCase: RegisterStockEntryUseCase,
    private readonly adjustUseCase: AdjustStockUseCase,
    private readonly transferUseCase: TransferStockUseCase,
    private readonly listKardexUseCase: ListKardexUseCase,
    private readonly listBranchStockUseCase: ListBranchStockUseCase
  ) {}

  registerEntry = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = stockEntrySchema.parse(req.body);
      res.status(201).json(await this.registerEntryUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  adjust = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = stockAdjustSchema.parse(req.body);
      res.status(201).json(await this.adjustUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  transfer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = transferStockSchema.parse(req.body);
      await this.transferUseCase.execute(body);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  listKardex = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listKardexQuerySchema.parse(req.query);
      res.json({ data: await this.listKardexUseCase.execute(query) });
    } catch (err) {
      next(err);
    }
  };

  listBranchStock = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listBranchStockQuerySchema.parse(req.query);
      res.json({ data: await this.listBranchStockUseCase.execute(query.branchId) });
    } catch (err) {
      next(err);
    }
  };
}
