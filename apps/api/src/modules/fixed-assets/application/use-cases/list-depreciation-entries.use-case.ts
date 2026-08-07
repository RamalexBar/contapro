import type {
  DepreciationEntryRecord,
  IDepreciationEntryRepository,
  ListDepreciationEntriesFilter,
} from "../../domain/depreciation-entry.repository";

export class ListDepreciationEntriesUseCase {
  constructor(private readonly repo: IDepreciationEntryRepository) {}

  execute(filter?: ListDepreciationEntriesFilter): Promise<DepreciationEntryRecord[]> {
    return this.repo.list(filter);
  }
}
