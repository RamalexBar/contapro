export interface CreateNumberingResolutionData {
  branchId?: string | null;
  resolutionNumber: string;
  prefix: string;
  rangeFrom: number;
  rangeTo: number;
  validFrom: Date;
  validUntil: Date;
}

export interface NumberingResolutionRecord {
  id: string;
  branchId: string | null;
  resolutionNumber: string;
  prefix: string;
  rangeFrom: number;
  rangeTo: number;
  currentNumber: number;
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
}

/**
 * CRUD administrativo de resoluciones. El reclamo atomico del siguiente numero vive en
 * IElectronicInvoiceRepository.claimNumberAndGenerate, no aqui, para garantizar que reclamar
 * numero + crear la factura ocurran en una sola transaccion.
 */
export interface IInvoiceNumberingResolutionRepository {
  create(data: CreateNumberingResolutionData): Promise<NumberingResolutionRecord>;
  list(): Promise<NumberingResolutionRecord[]>;
}
