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
