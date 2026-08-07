import type { NextFunction, Request, Response } from "express";
import { calculateDepreciationSchema, createFixedAssetSchema, updateFixedAssetSchema } from "./fixed-assets.validators";
import type { CreateFixedAssetUseCase } from "../application/use-cases/create-fixed-asset.use-case";
import type { UpdateFixedAssetUseCase } from "../application/use-cases/update-fixed-asset.use-case";
import type { DeactivateFixedAssetUseCase } from "../application/use-cases/deactivate-fixed-asset.use-case";
import type { ListFixedAssetsUseCase } from "../application/use-cases/list-fixed-assets.use-case";
import type { CalculateDepreciationUseCase } from "../application/use-cases/calculate-depreciation.use-case";
import type { ListDepreciationEntriesUseCase } from "../application/use-cases/list-depreciation-entries.use-case";
import type { PostDepreciationEntryUseCase } from "../application/use-cases/post-depreciation-entry.use-case";
import type { DepreciationEntryStatus } from "../domain/depreciation-entry.repository";

export class FixedAssetsController {
  constructor(
    private readonly createAssetUseCase: CreateFixedAssetUseCase,
    private readonly updateAssetUseCase: UpdateFixedAssetUseCase,
    private readonly deactivateAssetUseCase: DeactivateFixedAssetUseCase,
    private readonly listAssetsUseCase: ListFixedAssetsUseCase,
    private readonly calculateUseCase: CalculateDepreciationUseCase,
    private readonly listEntriesUseCase: ListDepreciationEntriesUseCase,
    private readonly postEntryUseCase: PostDepreciationEntryUseCase
  ) {}

  listAssets = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listAssetsUseCase.execute() });
    } catch (err) {
      next(err);
    }
  };

  createAsset = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createFixedAssetSchema.parse(req.body);
      res.status(201).json(await this.createAssetUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  updateAsset = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateFixedAssetSchema.parse(req.body);
      res.json(await this.updateAssetUseCase.execute(req.params.id, body));
    } catch (err) {
      next(err);
    }
  };

  deactivateAsset = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.deactivateAssetUseCase.execute(req.params.id));
    } catch (err) {
      next(err);
    }
  };

  calculate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = calculateDepreciationSchema.parse(req.body);
      res.json({ data: await this.calculateUseCase.execute(body.year, body.month) });
    } catch (err) {
      next(err);
    }
  };

  listEntries = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const year = typeof req.query.year === "string" ? Number(req.query.year) : undefined;
      const month = typeof req.query.month === "string" ? Number(req.query.month) : undefined;
      const status = typeof req.query.status === "string" ? (req.query.status as DepreciationEntryStatus) : undefined;
      res.json({ data: await this.listEntriesUseCase.execute({ year, month, status }) });
    } catch (err) {
      next(err);
    }
  };

  postEntry = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.postEntryUseCase.execute(req.params.id));
    } catch (err) {
      next(err);
    }
  };
}
