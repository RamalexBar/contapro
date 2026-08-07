import type { NextFunction, Request, Response } from "express";
import { closeAsWonSchema, createOpportunitySchema, updateStageSchema } from "./opportunity.validators";
import type { CreateOpportunityUseCase } from "../application/use-cases/create-opportunity.use-case";
import type { ListOpportunitiesUseCase } from "../application/use-cases/list-opportunities.use-case";
import type { UpdateStageUseCase } from "../application/use-cases/update-stage.use-case";
import type { CloseOpportunityAsWonUseCase } from "../application/use-cases/close-opportunity-as-won.use-case";

export class OpportunityController {
  constructor(
    private readonly createUseCase: CreateOpportunityUseCase,
    private readonly listUseCase: ListOpportunitiesUseCase,
    private readonly updateStageUseCase: UpdateStageUseCase,
    private readonly closeAsWonUseCase: CloseOpportunityAsWonUseCase
  ) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createOpportunitySchema.parse(req.body);
      res.status(201).json(await this.createUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stage = typeof req.query.stage === "string" ? req.query.stage : undefined;
      const customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;
      res.json({ data: await this.listUseCase.execute({ stage, customerId }) });
    } catch (err) {
      next(err);
    }
  };

  updateStage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateStageSchema.parse(req.body);
      res.json(await this.updateStageUseCase.execute({ opportunityId: req.params.id, ...body }));
    } catch (err) {
      next(err);
    }
  };

  closeAsWon = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = closeAsWonSchema.parse(req.body);
      res.json(await this.closeAsWonUseCase.execute({ opportunityId: req.params.id, ...body }));
    } catch (err) {
      next(err);
    }
  };
}
