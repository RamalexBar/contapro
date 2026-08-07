import type { IWithholdingConceptRepository, WithholdingConceptRecord } from "../../domain/withholding-concept.repository";

export class ListWithholdingConceptsUseCase {
  constructor(private readonly repo: IWithholdingConceptRepository) {}

  execute(): Promise<WithholdingConceptRecord[]> {
    return this.repo.list();
  }
}
