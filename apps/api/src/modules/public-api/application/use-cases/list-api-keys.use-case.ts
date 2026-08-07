import type { ApiKeyRecord, IApiKeyRepository } from "../../domain/api-key.repository";

export class ListApiKeysUseCase {
  constructor(private readonly repo: IApiKeyRepository) {}

  execute(): Promise<ApiKeyRecord[]> {
    return this.repo.list();
  }
}
