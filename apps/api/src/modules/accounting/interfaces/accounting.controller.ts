import type { NextFunction, Request, Response } from "express";
import type { AccountingReportsService } from "../application/accounting-reports.service";
import type { CreateAccountUseCase } from "../application/use-cases/create-account.use-case";
import type { CreateJournalEntryUseCase } from "../application/use-cases/create-journal-entry.use-case";
import type { PostJournalEntryUseCase } from "../application/use-cases/post-journal-entry.use-case";
import type { VoidJournalEntryUseCase } from "../application/use-cases/void-journal-entry.use-case";
import type { IChartOfAccountsRepository } from "../domain/chart-of-accounts.repository";
import type { IJournalEntryRepository } from "../domain/journal-entry.repository";
import { createAccountSchema, createJournalEntrySchema } from "./accounting.validators";

export class AccountingController {
  constructor(
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly journalRepo: IJournalEntryRepository,
    private readonly reports: AccountingReportsService,
    private readonly createAccountUseCase: CreateAccountUseCase,
    private readonly createEntryUseCase: CreateJournalEntryUseCase,
    private readonly postEntryUseCase: PostJournalEntryUseCase,
    private readonly voidEntryUseCase: VoidJournalEntryUseCase
  ) {}

  listAccounts = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.accountRepo.list() });
    } catch (err) {
      next(err);
    }
  };

  createAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createAccountSchema.parse(req.body);
      res.status(201).json(await this.createAccountUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  listEntries = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      res.json({ data: await this.journalRepo.list({ status }) });
    } catch (err) {
      next(err);
    }
  };

  getEntry = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.journalRepo.findByIdOrThrow(req.params.id));
    } catch (err) {
      next(err);
    }
  };

  createEntry = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createJournalEntrySchema.parse(req.body);
      res.status(201).json(await this.createEntryUseCase.execute({ ...body, type: "MANUAL" }));
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

  voidEntry = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.voidEntryUseCase.execute(req.params.id));
    } catch (err) {
      next(err);
    }
  };

  getBalanceSheet = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const asOf = typeof req.query.asOf === "string" ? new Date(req.query.asOf) : new Date();
      res.json(await this.reports.getBalanceSheet(asOf));
    } catch (err) {
      next(err);
    }
  };

  getIncomeStatement = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const from = typeof req.query.from === "string" ? new Date(req.query.from) : new Date(0);
      const to = typeof req.query.to === "string" ? new Date(req.query.to) : new Date();
      res.json(await this.reports.getIncomeStatement(from, to));
    } catch (err) {
      next(err);
    }
  };

  getLedger = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const from = typeof req.query.from === "string" ? new Date(req.query.from) : undefined;
      const to = typeof req.query.to === "string" ? new Date(req.query.to) : undefined;
      res.json({ data: await this.reports.getLedger(req.params.accountId, from, to) });
    } catch (err) {
      next(err);
    }
  };
}
