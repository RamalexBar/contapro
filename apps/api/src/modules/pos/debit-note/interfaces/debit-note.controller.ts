import type { NextFunction, Request, Response } from "express";
import type { CreateDebitNoteUseCase } from "../application/use-cases/create-debit-note.use-case";
import type { ListDebitNotesUseCase } from "../application/use-cases/list-debit-notes.use-case";
import { createDebitNoteSchema } from "./debit-note.validators";

export class DebitNoteController {
  constructor(private readonly createUseCase: CreateDebitNoteUseCase, private readonly listUseCase: ListDebitNotesUseCase) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createDebitNoteSchema.parse(req.body);
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
