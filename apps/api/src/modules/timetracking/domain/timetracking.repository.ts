export interface TimeEntryRecord {
  id: string;
  employeeId: string;
  branchId: string;
  clockIn: Date;
  clockOut: Date | null;
  source: string;
  notes: string | null;
}

export interface ITimeTrackingRepository {
  findOpenEntry(employeeId: string): Promise<TimeEntryRecord | null>;
  clockIn(employeeId: string, branchId: string, clockIn: Date, source: string, notes?: string): Promise<TimeEntryRecord>;
  clockOut(id: string, clockOut: Date): Promise<TimeEntryRecord>;
  findByIdOrThrow(id: string): Promise<TimeEntryRecord>;
  list(filter: { employeeId?: string; from?: Date; to?: Date }): Promise<TimeEntryRecord[]>;
  /** Solo entradas cerradas (clockOut no nulo) dentro del rango, usado por el motor de nomina. */
  listClosedForPeriod(employeeId: string, from: Date, to: Date): Promise<TimeEntryRecord[]>;
}
