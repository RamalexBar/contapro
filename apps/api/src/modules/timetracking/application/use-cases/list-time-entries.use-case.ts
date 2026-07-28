import type { ListTimeEntriesQuery } from "@erp/shared-types";
import type { ITimeTrackingRepository, TimeEntryRecord } from "../../domain/timetracking.repository";

export class ListTimeEntriesUseCase {
  constructor(private readonly repo: ITimeTrackingRepository) {}

  async execute(query: ListTimeEntriesQuery): Promise<TimeEntryRecord[]> {
    return this.repo.list({ employeeId: query.employeeId, from: query.from, to: query.to });
  }
}
