export interface FinancialPeriodRecord {
  id: string;
  year: number;
  month: number;
  status: "OPEN" | "CLOSED";
  closedAt: Date | null;
}

export interface IFinancialPeriodRepository {
  list(year?: number): Promise<FinancialPeriodRecord[]>;
  /** null si el periodo esta abierto (no existe fila -- OPEN es el estado implicito por defecto). */
  findClosed(year: number, month: number): Promise<FinancialPeriodRecord | null>;
  close(year: number, month: number): Promise<FinancialPeriodRecord>;
  reopen(year: number, month: number): Promise<FinancialPeriodRecord>;
}
