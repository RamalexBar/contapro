import { describe, expect, it } from "vitest";
import type { CompanyMatch, IUserRepository, UserWithAccess } from "../../domain/user.repository";
import type { IPasswordResetTokenRepository } from "../../domain/password-reset-token.repository";
import type { IPasswordResetNotifier, PasswordResetNotification } from "../../domain/password-reset-notifier";
import { RequestPasswordResetUseCase } from "./request-password-reset.use-case";
import { linksHtml } from "../../infrastructure/resend-password-reset-notifier";

function user(companyId: string, overrides: Partial<UserWithAccess> = {}): UserWithAccess {
  return {
    id: `user-${companyId}`,
    companyId,
    email: "alex@correo.com",
    passwordHash: "x",
    pinHash: null,
    fullName: "Alex",
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    defaultBranchId: null,
    roles: [],
    permissions: [],
    companyIsActive: true,
    ...overrides,
  };
}

function setup(companies: CompanyMatch[], users: Record<string, UserWithAccess>) {
  const tokens: string[] = [];
  const sent: PasswordResetNotification[] = [];
  const userRepo = {
    findCompaniesByEmail: async () => companies,
    findByEmailWithAccess: async (companyId: string | undefined) => (companyId ? (users[companyId] ?? null) : null),
  } as unknown as IUserRepository;
  const tokenRepo = { create: async (userId: string) => void tokens.push(userId) } as unknown as IPasswordResetTokenRepository;
  const notifier: IPasswordResetNotifier = { send: async (n) => void sent.push(n) };
  return { useCase: new RequestPasswordResetUseCase(userRepo, tokenRepo, notifier, "https://contapro.com.co"), tokens, sent };
}

describe("RequestPasswordResetUseCase", () => {
  it("con el correo en varias empresas manda UN correo con un enlace por empresa", async () => {
    const { useCase, tokens, sent } = setup(
      [
        { companyId: "a", companyName: "ALEXANDER BARRIOS" },
        { companyId: "b", companyName: "Prueba Correo Resend" },
      ],
      { a: user("a"), b: user("b") }
    );
    await useCase.execute("alex@correo.com");

    expect(tokens).toEqual(["user-a", "user-b"]);
    expect(sent).toHaveLength(1);
    expect(sent[0].links.map((l) => l.companyName)).toEqual(["ALEXANDER BARRIOS", "Prueba Correo Resend"]);
    expect(sent[0].links[0].resetUrl).toMatch(/^https:\/\/contapro\.com\.co\/reset-password\?token=[0-9a-f]{64}$/);
    expect(sent[0].links[0].resetUrl).not.toBe(sent[0].links[1].resetUrl);
    expect(linksHtml(sent[0])).toContain("varias empresas");
  });

  it("omite usuarios inactivos y empresas archivadas", async () => {
    const { useCase, tokens, sent } = setup(
      [
        { companyId: "a", companyName: "Activa" },
        { companyId: "b", companyName: "Usuario inactivo" },
        { companyId: "c", companyName: "Archivada" },
      ],
      { a: user("a"), b: user("b", { isActive: false }), c: user("c", { companyIsActive: false }) }
    );
    await useCase.execute("alex@correo.com");
    expect(tokens).toEqual(["user-a"]);
    expect(sent[0].links.map((l) => l.companyName)).toEqual(["Activa"]);
    expect(linksHtml(sent[0])).toContain("Haz clic aquí");
  });

  it("no envia nada si el correo no existe", async () => {
    const { useCase, tokens, sent } = setup([], {});
    await useCase.execute("nadie@correo.com");
    expect(tokens).toEqual([]);
    expect(sent).toEqual([]);
  });
});
