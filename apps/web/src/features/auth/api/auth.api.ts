import type { AuthTokensResponse, LoginInput, RegisterCompanyInput } from "@erp/shared-types";
import { apiFetch } from "../../../lib/api-client";

export function login(input: LoginInput): Promise<AuthTokensResponse> {
  return apiFetch<AuthTokensResponse>("/auth/login", { method: "POST", body: input });
}

export function registerCompany(input: RegisterCompanyInput): Promise<{ companyId: string }> {
  return apiFetch("/auth/register-company", { method: "POST", body: input });
}

export function forgotPassword(email: string): Promise<{ message: string }> {
  return apiFetch("/auth/forgot-password", { method: "POST", body: { email } });
}

export function resetPassword(token: string, newPassword: string): Promise<void> {
  return apiFetch("/auth/reset-password", { method: "POST", body: { token, newPassword } });
}
