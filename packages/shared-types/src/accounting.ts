import { z } from "zod";

export const accountTypeEnum = z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]);

export const createAccountSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: accountTypeEnum,
  parentId: z.string().uuid().optional(),
  acceptsEntries: z.boolean().default(true),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const journalEntryLineSchema = z.object({
  accountId: z.string().uuid(),
  debit: z.number().nonnegative().default(0),
  credit: z.number().nonnegative().default(0),
  description: z.string().optional(),
});

export const createJournalEntrySchema = z.object({
  branchId: z.string().uuid().optional(),
  date: z.coerce.date(),
  description: z.string().min(1),
  lines: z.array(journalEntryLineSchema).min(2),
});
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;

export const createBankAccountSchema = z.object({
  bankName: z.string().min(1),
  accountNumber: z.string().min(1),
  accountType: z.string().min(1),
});
export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;

export const registerBankTransactionSchema = z.object({
  date: z.coerce.date(),
  description: z.string().min(1),
  amount: z.number().positive(),
  type: z.enum(["DEBIT", "CREDIT"]),
});
export type RegisterBankTransactionInput = z.infer<typeof registerBankTransactionSchema>;

export const startBankReconciliationSchema = z.object({
  bankAccountId: z.string().uuid(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  statementBalance: z.number(),
  bookBalance: z.number(),
});
export type StartBankReconciliationInput = z.infer<typeof startBankReconciliationSchema>;

export const matchBankReconciliationItemSchema = z
  .object({
    bankTransactionId: z.string().uuid().optional(),
    journalEntryLineId: z.string().uuid().optional(),
  })
  .refine((data) => data.bankTransactionId || data.journalEntryLineId, {
    message: "Debes indicar bankTransactionId y/o journalEntryLineId",
  });
export type MatchBankReconciliationItemInput = z.infer<typeof matchBankReconciliationItemSchema>;
