import type { NextFunction, Request, Response } from "express";
import type { AccountingReportsService } from "../application/accounting-reports.service";
import type { CreateAccountUseCase } from "../application/use-cases/create-account.use-case";
import type { CreateJournalEntryUseCase } from "../application/use-cases/create-journal-entry.use-case";
import type { PostJournalEntryUseCase } from "../application/use-cases/post-journal-entry.use-case";
import type { VoidJournalEntryUseCase } from "../application/use-cases/void-journal-entry.use-case";
import type { CreateBankAccountUseCase } from "../application/use-cases/create-bank-account.use-case";
import type { ListBankAccountsUseCase } from "../application/use-cases/list-bank-accounts.use-case";
import type { RegisterBankTransactionUseCase } from "../application/use-cases/register-bank-transaction.use-case";
import type { ListBankTransactionsUseCase } from "../application/use-cases/list-bank-transactions.use-case";
import type { StartBankReconciliationUseCase } from "../application/use-cases/start-bank-reconciliation.use-case";
import type { MatchBankReconciliationItemUseCase } from "../application/use-cases/match-bank-reconciliation-item.use-case";
import type { CloseBankReconciliationUseCase } from "../application/use-cases/close-bank-reconciliation.use-case";
import type { GetBankReconciliationUseCase } from "../application/use-cases/get-bank-reconciliation.use-case";
import type { ListBankReconciliationsUseCase } from "../application/use-cases/list-bank-reconciliations.use-case";
import type { IChartOfAccountsRepository } from "../domain/chart-of-accounts.repository";
import type { IJournalEntryRepository } from "../domain/journal-entry.repository";
import {
  createAccountSchema,
  createBankAccountSchema,
  createJournalEntrySchema,
  matchBankReconciliationItemSchema,
  registerBankTransactionSchema,
  startBankReconciliationSchema,
} from "./accounting.validators";

export class AccountingController {
  constructor(
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly journalRepo: IJournalEntryRepository,
    private readonly reports: AccountingReportsService,
    private readonly createAccountUseCase: CreateAccountUseCase,
    private readonly createEntryUseCase: CreateJournalEntryUseCase,
    private readonly postEntryUseCase: PostJournalEntryUseCase,
    private readonly voidEntryUseCase: VoidJournalEntryUseCase,
    private readonly createBankAccountUseCase: CreateBankAccountUseCase,
    private readonly listBankAccountsUseCase: ListBankAccountsUseCase,
    private readonly registerBankTransactionUseCase: RegisterBankTransactionUseCase,
    private readonly listBankTransactionsUseCase: ListBankTransactionsUseCase,
    private readonly startBankReconciliationUseCase: StartBankReconciliationUseCase,
    private readonly matchBankReconciliationItemUseCase: MatchBankReconciliationItemUseCase,
    private readonly closeBankReconciliationUseCase: CloseBankReconciliationUseCase,
    private readonly getBankReconciliationUseCase: GetBankReconciliationUseCase,
    private readonly listBankReconciliationsUseCase: ListBankReconciliationsUseCase
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

  getCashFlow = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const from = typeof req.query.from === "string" ? new Date(req.query.from) : new Date(0);
      const to = typeof req.query.to === "string" ? new Date(req.query.to) : new Date();
      res.json(await this.reports.getCashFlow(from, to));
    } catch (err) {
      next(err);
    }
  };

  createBankAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createBankAccountSchema.parse(req.body);
      res.status(201).json(await this.createBankAccountUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  listBankAccounts = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listBankAccountsUseCase.execute() });
    } catch (err) {
      next(err);
    }
  };

  registerBankTransaction = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = registerBankTransactionSchema.parse(req.body);
      res.status(201).json(await this.registerBankTransactionUseCase.execute({ ...body, bankAccountId: req.params.id }));
    } catch (err) {
      next(err);
    }
  };

  listBankTransactions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listBankTransactionsUseCase.execute(req.params.id) });
    } catch (err) {
      next(err);
    }
  };

  startBankReconciliation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = startBankReconciliationSchema.parse(req.body);
      res.status(201).json(await this.startBankReconciliationUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  listBankReconciliations = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listBankReconciliationsUseCase.execute() });
    } catch (err) {
      next(err);
    }
  };

  getBankReconciliation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.getBankReconciliationUseCase.execute(req.params.id));
    } catch (err) {
      next(err);
    }
  };

  matchBankReconciliationItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = matchBankReconciliationItemSchema.parse(req.body);
      res.status(201).json(await this.matchBankReconciliationItemUseCase.execute(req.params.id, body));
    } catch (err) {
      next(err);
    }
  };

  closeBankReconciliation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.closeBankReconciliationUseCase.execute(req.params.id));
    } catch (err) {
      next(err);
    }
  };
}
