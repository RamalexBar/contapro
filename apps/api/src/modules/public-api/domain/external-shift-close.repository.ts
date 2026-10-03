export interface ExternalShiftCloseRecord {
  id: string;
  companyId: string;
  branchId: string;
  externalReference: string;
  status: "POSTED" | "FAILED";
  journalEntryIds: string[];
  // Numero humano del/de los comprobante(s) (JournalEntry.number, ej. 412) -- para que el POS
  // pueda mostrarlo sin tener que resolver journalEntryIds contra otro endpoint. Paralelo a
  // journalEntryIds en todo (mismo orden, mismo largo).
  journalEntryNumbers: number[];
  errorMessage: string | null;
  createdAt: Date;
}

export interface CreateExternalShiftCloseData {
  // Generado por el caller (crypto.randomUUID()) ANTES de contabilizar, para poder usar el mismo
  // id como sourceId del comprobante contable (ver RegisterShiftCloseUseCase) -- asi el
  // comprobante y este registro se referencian entre si en ambas direcciones.
  id: string;
  branchId: string;
  externalReference: string;
  status: "POSTED" | "FAILED";
  journalEntryIds: string[];
  journalEntryNumbers: number[];
  errorMessage?: string | null;
}

/**
 * Idempotencia + trazabilidad de cierres de turno reportados por un POS externo (ver
 * RegisterShiftCloseUseCase). `externalReference` es del propio POS -- unico por empresa, asi que
 * un reintento de red del mismo cierre no duplica el comprobante contable.
 */
export interface UpdateExternalShiftCloseData {
  status: "POSTED" | "FAILED";
  journalEntryIds: string[];
  journalEntryNumbers: number[];
  errorMessage?: string | null;
}

export interface IExternalShiftCloseRepository {
  create(data: CreateExternalShiftCloseData): Promise<ExternalShiftCloseRecord>;
  /** Usado para reintentar un cierre que quedo en FAILED -- nunca se llama sobre uno POSTED (ver
   * RegisterShiftCloseUseCase, que es donde vive esa regla). */
  update(id: string, data: UpdateExternalShiftCloseData): Promise<ExternalShiftCloseRecord>;
  findByExternalReference(externalReference: string): Promise<ExternalShiftCloseRecord | null>;
  list(filter?: { take?: number; skip?: number }): Promise<ExternalShiftCloseRecord[]>;
}
