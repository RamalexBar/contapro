import type { NextFunction, Request, Response } from "express";
import type { CreateCreditNoteUseCase } from "../application/use-cases/create-credit-note.use-case";
import type { ListCreditNotesUseCase } from "../application/use-cases/list-credit-notes.use-case";
import { createCreditNoteSchema } from "./credit-note.validators";

export class CreditNoteController {
  constructor(
    private readonly createUseCase: CreateCreditNoteUseCase,
    private readonly listUseCase: ListCreditNotesUseCase
  ) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createCreditNoteSchema.parse(req.body);
      res.status(201).json(await this.createUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  list = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listUseCase.execute() });
    } catch (err) {
      next(err);
    }
  };
}
