import type { AuditService } from "../../../audit/application/audit.service";
import type { ApiKeyRecord, IApiKeyRepository } from "../../domain/api-key.repository";

export class DeactivateApiKeyUseCase {
  constructor(private readonly repo: IApiKeyRepository, private readonly audit: AuditService) {}

  async execute(id: string): Promise<ApiKeyRecord> {
    const apiKey = await this.repo.deactivate(id);

    await this.audit.record({
      action: "API_KEY_DEACTIVATED",
      entityType: "ApiKey",
      entityId: apiKey.id,
      description: `API key revocada: ${apiKey.name}`,
    });

    return apiKey;
  }
}
