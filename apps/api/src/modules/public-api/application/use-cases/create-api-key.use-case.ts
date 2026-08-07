import { randomBytes, createHash } from "node:crypto";
import { getTenantContext } from "../../../../shared/context/request-context";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ApiKeyRecord, IApiKeyRepository } from "../../domain/api-key.repository";

export interface CreateApiKeyInput {
  name: string;
  scopes: string[];
}

/** Devuelto SOLO por este caso de uso -- la key en texto plano nunca se vuelve a poder
 * recuperar despues de esta respuesta (solo se persiste su hash). */
export interface CreateApiKeyResult extends ApiKeyRecord {
  key: string;
}

const KEY_PREFIX = "pk_live_";

export class CreateApiKeyUseCase {
  constructor(private readonly repo: IApiKeyRepository, private readonly audit: AuditService) {}

  async execute(input: CreateApiKeyInput): Promise<CreateApiKeyResult> {
    const ctx = getTenantContext();

    if (input.scopes.length === 0) {
      throw new ValidationError("La API key debe tener al menos un scope");
    }
    const notGranted = input.scopes.filter((scope) => !ctx.permissions.has(scope));
    if (notGranted.length > 0) {
      throw new ValidationError(`No puedes otorgar scopes que no tienes: ${notGranted.join(", ")}`);
    }

    const rawKey = KEY_PREFIX + randomBytes(24).toString("hex");
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.slice(0, KEY_PREFIX.length + 6);

    const apiKey = await this.repo.create({
      name: input.name,
      scopes: input.scopes,
      createdByUserId: ctx.userId,
      keyHash,
      keyPrefix,
    });

    await this.audit.record({
      action: "API_KEY_CREATED",
      entityType: "ApiKey",
      entityId: apiKey.id,
      description: `API key creada: ${apiKey.name} (scopes: ${apiKey.scopes.join(", ")})`,
    });

    return { ...apiKey, key: rawKey };
  }
}
