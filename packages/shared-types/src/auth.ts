import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
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
});
export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

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
