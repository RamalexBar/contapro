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
  /** Base minima en UVT desde la que se practica (0 = desde cualquier valor). */
  minBaseUvt: number;
  /** Tarifa para proveedores que no declaran renta (null = la misma ratePercent). */
  nonDeclarantRatePercent: number | null;
}

export interface CreateWithholdingConceptData {
  code: string;
  name: string;
  type: WithholdingType;
  ratePercent: number;
  dianConceptCode?: string;
  minBaseUvt?: number;
  nonDeclarantRatePercent?: number | null;
}

export interface UpdateWithholdingConceptData {
  name?: string;
  ratePercent?: number;
  dianConceptCode?: string;
  minBaseUvt?: number;
  nonDeclarantRatePercent?: number | null;
}

export interface IWithholdingConceptRepository {
  create(data: CreateWithholdingConceptData): Promise<WithholdingConceptRecord>;
  list(): Promise<WithholdingConceptRecord[]>;
  findByIdOrThrow(id: string): Promise<WithholdingConceptRecord>;
  update(id: string, data: UpdateWithholdingConceptData): Promise<WithholdingConceptRecord>;
  deactivate(id: string): Promise<WithholdingConceptRecord>;
}
