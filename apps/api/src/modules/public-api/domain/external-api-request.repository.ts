export interface ExternalApiRequestRecord {
  id: string;
  endpoint: string;
  externalReference: string;
  status: "POSTED" | "FAILED";
  responseBody: unknown;
  errorMessage: string | null;
  createdAt: Date;
}

export interface CreateExternalApiRequestData {
  endpoint: string;
  externalReference: string;
  status: "POSTED" | "FAILED";
  responseBody?: unknown;
  errorMessage?: string | null;
}

export interface UpdateExternalApiRequestData {
  status: "POSTED" | "FAILED";
  responseBody?: unknown;
  errorMessage?: string | null;
}

/**
 * Idempotencia generica por (companyId, endpoint, externalReference) para endpoints de la API
 * publica distintos del cierre de turno (que ya tiene su propia tabla dedicada,
 * ExternalShiftClose, con journalEntryIds propios porque necesita poder anular comprobantes
 * puntuales). Usado por POST /purchases y POST /supplier-payments: `responseBody` guarda la
 * respuesta completa servida la primera vez, asi que un reintento con la misma key la devuelve
 * tal cual sin volver a ejecutar nada.
 */
export interface IExternalApiRequestRepository {
  create(data: CreateExternalApiRequestData): Promise<ExternalApiRequestRecord>;
  /** Usado para reintentar una llamada que quedo en FAILED -- nunca se llama sobre una POSTED. */
  update(id: string, data: UpdateExternalApiRequestData): Promise<ExternalApiRequestRecord>;
  findByReference(endpoint: string, externalReference: string): Promise<ExternalApiRequestRecord | null>;
}
