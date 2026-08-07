export interface CashSessionRecord {
  id: string;
  branchId: string;
  cashRegisterId: string;
  openedByUserId: string;
  closedByUserId: string | null;
  openingAmount: number;
  closingAmountExpected: number | null;
  closingAmountCounted: number | null;
  difference: number | null;
  status: string;
  openedAt: Date;
  closedAt: Date | null;
}

export interface ICashSessionRepository {
  open(cashRegisterId: string, branchId: string, openingAmount: number, userId: string): Promise<CashSessionRecord>;
  findActiveByRegister(cashRegisterId: string): Promise<CashSessionRecord | null>;
  findByIdOrThrow(id: string): Promise<CashSessionRecord>;
  close(
    id: string,
    closingAmountCounted: number,
    userId: string,
    notes?: string,
    counts?: Array<{ denomination: number; quantity: number }>
  ): Promise<CashSessionRecord>;
  /** Devuelve el id del CashMovement creado -- item 42 de docs/ALCANCE.md lo necesita para
   * reportar `entityId` en el resultado de sync (mismo criterio que CreateSaleUseCase). */
  registerMovement(cashSessionId: string, type: string, amount: number, concept: string, userId: string): Promise<{ id: string }>;
  sumMovements(cashSessionId: string): Promise<number>;
  /** Usado por AccountingReportsService.getCashFlow -- agregado por companyId via la relacion a
   * CashSession (CashMovement no tiene columna companyId propia). */
  sumMovementsByType(from: Date, to: Date): Promise<Array<{ type: string; total: number }>>;
}
