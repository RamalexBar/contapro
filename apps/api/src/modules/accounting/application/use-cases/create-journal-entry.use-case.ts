import { round2 } from "@erp/shared-utils";
import { getTenantContext } from "../../../../shared/context/request-context";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { CreateJournalEntryData, IJournalEntryRepository, JournalEntryRecord } from "../../domain/journal-entry.repository";

export type CreateJournalEntryInput = Omit<CreateJournalEntryData, "createdByUserId">;

/** Un comprobante manual siempre nace en DRAFT; se publica aparte con PostJournalEntryUseCase. */
export class CreateJournalEntryUseCase {
  constructor(
    private readonly journalRepo: IJournalEntryRepository,
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly audit: AuditService
  ) {}

  async execute(input: CreateJournalEntryInput): Promise<JournalEntryRecord> {
    if (input.lines.length < 2) {
      throw new ValidationError("Un comprobante necesita al menos dos movimientos");
    }

    const totalDebit = round2(input.lines.reduce((sum, l) => sum + l.debit, 0));
    const totalCredit = round2(input.lines.reduce((sum, l) => sum + l.credit, 0));
    if (totalDebit !== totalCredit) {
      throw new ValidationError(`El comprobante no cuadra: debitos ${totalDebit} vs creditos ${totalCredit}`);
    }
    if (totalDebit === 0) {
      throw new ValidationError("El comprobante no puede tener movimientos en cero");
    }

    for (const line of input.lines) {
      const account = await this.accountRepo.findByIdOrThrow(line.accountId);
      if (!account.acceptsEntries) {
        throw new ValidationError(`La cuenta ${account.code} ${account.name} no acepta movimientos directos`);
      }
      if (line.debit > 0 && line.credit > 0) {
        throw new ValidationError("Cada movimiento debe ser debito O credito, no ambos");
      }
    }

    const ctx = getTenantContext();
    const entry = await this.journalRepo.create({ ...input, createdByUserId: ctx.userId });

    await this.audit.record({
      action: "JOURNAL_ENTRY_CREATED",
      entityType: "JournalEntry",
      entityId: entry.id,
      description: `Comprobante #${entry.number} creado: ${entry.description}`,
    });

    return entry;
  }
}
