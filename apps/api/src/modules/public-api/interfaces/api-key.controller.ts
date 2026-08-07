import type { NextFunction, Request, Response } from "express";
import { createApiKeySchema } from "./api-key.validators";
import type { CreateApiKeyUseCase } from "../application/use-cases/create-api-key.use-case";
import type { ListApiKeysUseCase } from "../application/use-cases/list-api-keys.use-case";
import type { DeactivateApiKeyUseCase } from "../application/use-cases/deactivate-api-key.use-case";

export class ApiKeyController {
  constructor(
    private readonly createUseCase: CreateApiKeyUseCase,
    private readonly listUseCase: ListApiKeysUseCase,
    private readonly deactivateUseCase: DeactivateApiKeyUseCase
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
      const body = createApiKeySchema.parse(req.body);
      res.status(201).json(await this.createUseCase.execute(body));
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
}
