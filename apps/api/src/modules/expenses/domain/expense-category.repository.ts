export interface ExpenseCategoryRecord {
  id: string;
  code: string;
  name: string;
  accountCode: string;
  isActive: boolean;
}

export interface CreateExpenseCategoryData {
  code: string;
  name: string;
  accountCode: string;
}

export interface UpdateExpenseCategoryData {
  name?: string;
  accountCode?: string;
}

export interface IExpenseCategoryRepository {
  create(data: CreateExpenseCategoryData): Promise<ExpenseCategoryRecord>;
  list(): Promise<ExpenseCategoryRecord[]>;
  findByIdOrThrow(id: string): Promise<ExpenseCategoryRecord>;
  update(id: string, data: UpdateExpenseCategoryData): Promise<ExpenseCategoryRecord>;
  deactivate(id: string): Promise<ExpenseCategoryRecord>;
  /** Usado por la API publica: el POS externo manda el `code` configurado por el contador (no
   * conoce el id interno de Contapro) -- mismo criterio que ISupplierRepository.findByNit. */
  findByCode(code: string): Promise<ExpenseCategoryRecord | null>;
}
