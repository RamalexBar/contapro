/** Roles de sistema (compartidos entre todas las empresas, no editables por el tenant). */
export const SYSTEM_ROLES = [
  "ADMINISTRADOR",
  "PROPIETARIO",
  "CONTADOR",
  "SUPERVISOR",
  "CAJERO",
  "EMPLEADO",
] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];
