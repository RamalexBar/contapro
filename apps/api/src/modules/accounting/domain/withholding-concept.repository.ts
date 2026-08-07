export type WithholdingType = "RETEFUENTE" | "RETEICA" | "RETEIVA";

export interface WithholdingConceptRecord {
  id: string;
  code: string;
  name: string;
  type: WithholdingType;
  ratePercent: number;
  isActive: boolean;
  // Item 37 de docs/ALCANCE.md (informacion exogena DIAN, formato 1003): codigo numerico DIAN de
  // concepto de retencion. Null = sin asignar, el reporte marca la fila "conceptoIncompleto".
  dianConceptCode: string | null;
}

export interface CreateWithholdingConceptData {
  code: string;
  name: string;
  type: WithholdingType;
  ratePercent: number;
  dianConceptCode?: string;
}

export interface UpdateWithholdingConceptData {
  name?: string;
  ratePercent?: number;
  dianConceptCode?: string;
}

export interface IWithholdingConceptRepository {
  create(data: CreateWithholdingConceptData): Promise<WithholdingConceptRecord>;
  list(): Promise<WithholdingConceptRecord[]>;
  findByIdOrThrow(id: string): Promise<WithholdingConceptRecord>;
  update(id: string, data: UpdateWithholdingConceptData): Promise<WithholdingConceptRecord>;
  deactivate(id: string): Promise<WithholdingConceptRecord>;
}
