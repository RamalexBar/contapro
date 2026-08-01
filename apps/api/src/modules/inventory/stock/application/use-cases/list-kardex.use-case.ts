import type { IKardexRepository, KardexEntryRecord, ListKardexFilter } from "../../domain/kardex.repository";

export class ListKardexUseCase {
  constructor(private readonly repo: IKardexRepository) {}

  execute(filter: ListKardexFilter): Promise<KardexEntryRecord[]> {
    return this.repo.list(filter);
  }
}
