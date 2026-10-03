import crypto from "node:crypto";
import type { RegisterShiftCloseInput } from "@erp/shared-types";
import type { AuditService } from "../../../audit/application/audit.service";
import type { PostShiftCloseJournalEntryUseCase } from "../../../accounting/application/use-cases/post-shift-close-journal-entry.use-case";
import type { ExternalShiftCloseRecord, IExternalShiftCloseRepository } from "../../domain/external-shift-close.repository";

/**
 * Orquesta un cierre de turno de un POS externo: idempotencia (un reintento del mismo
 * `externalReference` que YA quedo POSTED devuelve ese resultado sin reprocesar, nunca duplica el
 * comprobante), contabilizacion (PostShiftCloseJournalEntryUseCase, modulo accounting), y
 * registro del resultado para que el POS pueda consultar que se contabilizo y que fallo (ver
 * ListShiftClosesUseCase / GET /public/v1/shift-closes).
 *
 * Un cierre que quedo en FAILED (ej. por un timeout de red del lado del POS, o un fallo temporal)
 * SI se reintenta cuando llega de nuevo la misma `externalReference` -- solo lo YA POSTED es
 * intocable. Bug real encontrado y corregido mientras se escribian los tests: la primera version
 * trataba POSTED y FAILED igual (devolvia el registro guardado sin reintentar en ningun caso),
 * lo que dejaba un cierre fallido atascado para siempre sin ninguna forma de recuperarse.
 */
export class RegisterShiftCloseUseCase {
  constructor(
    private readonly repo: IExternalShiftCloseRepository,
    private readonly postShiftCloseJournalEntry: PostShiftCloseJournalEntryUseCase,
    private readonly audit: AuditService
  ) {}

  async execute(input: RegisterShiftCloseInput): Promise<ExternalShiftCloseRecord> {
    const existing = await this.repo.findByExternalReference(input.externalReference);
    if (existing?.status === "POSTED") return existing;

    const id = existing?.id ?? crypto.randomUUID();

    try {
      const entry = await this.postShiftCloseJournalEntry.execute(id, input);
      const journalEntryIds = entry ? [entry.id] : [];
      const journalEntryNumbers = entry ? [entry.number] : [];
      const record = existing
        ? await this.repo.update(id, { status: "POSTED", journalEntryIds, journalEntryNumbers })
        : await this.repo.create({
            id,
            branchId: input.branchId,
            externalReference: input.externalReference,
            status: "POSTED",
            journalEntryIds,
            journalEntryNumbers,
          });

      await this.audit.record({
        action: "SHIFT_CLOSE_POSTED",
        entityType: "ExternalShiftClose",
        entityId: record.id,
        description: `Cierre de turno ${input.externalReference} contabilizado${entry ? ` (comprobante #${entry.number})` : " (sin movimientos, nada que contabilizar)"}`,
      });

      return record;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const record = existing
        ? await this.repo.update(id, { status: "FAILED", journalEntryIds: [], journalEntryNumbers: [], errorMessage })
        : await this.repo.create({
            id,
            branchId: input.branchId,
            externalReference: input.externalReference,
            status: "FAILED",
            journalEntryIds: [],
            journalEntryNumbers: [],
            errorMessage,
          });

      await this.audit.record({
        action: "SHIFT_CLOSE_FAILED",
        entityType: "ExternalShiftClose",
        entityId: record.id,
        description: `Cierre de turno ${input.externalReference} fallo al contabilizar: ${errorMessage}`,
      });

      return record;
    }
  }
}
