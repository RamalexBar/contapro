import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  /** Explicito cuando el email ya disparo un error MULTIPLE_COMPANIES antes (ver
   * MultipleCompaniesError) y el usuario eligio una empresa en el selector del frontend. */
  companyId: z.string().uuid().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerCompanySchema = z.object({
  companyName: z.string().min(2),
  legalName: z.string().min(2),
  nit: z.string().min(5),
  companyEmail: z.string().email(),
  branchName: z.string().min(2).default("Sucursal principal"),
  adminFullName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  // Codigo DANE del municipio (catalogo de @erp/shared-utils). La web lo exige; opcional aqui para
  // no romper clientes viejos (app movil). Factus lo necesita para facturarle a la empresa.
  municipalityCode: z.string().regex(/^\d{5}$/, "Código DANE inválido").optional(),
});
export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  companyId: string;
  branchId: string | null;
  roles: string[];
  permissions: string[];
}

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}
