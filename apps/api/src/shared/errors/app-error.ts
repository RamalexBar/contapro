export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super(`${entity} no encontrado${id ? ` (${id})` : ""}`, 404, "NOT_FOUND");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "No tienes permiso para realizar esta accion") {
    super(message, 403, "FORBIDDEN");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "No autenticado") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 422, "VALIDATION_ERROR", details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

/** El email de un usuario solo es unico POR empresa (ver User.@@unique([companyId, email])),
 * no globalmente -- si el mismo email existe en mas de una empresa, el login no puede saber cual
 * quiso el usuario sin preguntar. `companies` va en `details` para que el frontend muestre un
 * selector y reintente el login con `companyId` explicito. */
export class MultipleCompaniesError extends AppError {
  constructor(companies: { companyId: string; companyName: string }[]) {
    super("Este correo esta registrado en mas de una empresa. Selecciona con cual deseas ingresar.", 409, "MULTIPLE_COMPANIES", {
      companies,
    });
  }
}

export class CertificateError extends AppError {
  constructor(message: string) {
    super(message, 500, "CERTIFICATE_ERROR");
  }
}
