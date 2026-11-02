import { describe, expect, it } from "vitest";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ILoginLinkRepository } from "../../domain/login-link.repository";
import type { IUserRepository, UserWithAccess } from "../../domain/user.repository";
import { sha256 } from "../../infrastructure/password-hasher.service";
import { CreateLoginLinkUseCase, LoginWithLinkUseCase } from "./login-links.use-case";

const ana: UserWithAccess = {
  id: "u-1",
  companyId: "co-1",
  email: "ana@correo.com",
  passwordHash: "x",
  pinHash: null,
  fullName: "Ana",
  isActive: true,
  failedLoginAttempts: 0,
  lockedUntil: null,
  defaultBranchId: "br-1",
  roles: ["ADMINISTRADOR"],
  permissions: ["sale.create"],
  companyIsActive: true,
};

function setup(user: UserWithAccess = ana) {
  const links: { userId: string; tokenHash: string; source: string; expiresAt: Date; usedAt: Date | null }[] = [];
  const clock = { now: new Date("2026-11-02T15:00:00Z") };
  const refreshTokens: string[] = [];
  const audits: string[] = [];
  const userRepo = {
    findByEmailWithAccess: async (companyId: string | undefined, email: string) => (companyId === user.companyId && email === user.email ? user : null),
    findByIdWithAccess: async (id: string) => (id === user.id ? user : null),
    resetFailedLogins: async () => undefined,
    updateLastLogin: async () => undefined,
    saveRefreshToken: async (_u: string, tokenId: string) => void refreshTokens.push(tokenId),
  } as unknown as IUserRepository;
  const linkRepo: ILoginLinkRepository = {
    create: async (d) => void links.push({ ...d, usedAt: null }),
    consume: async (tokenHash, now) => {
      const l = links.find((x) => x.tokenHash === tokenHash && !x.usedAt && x.expiresAt > now);
      if (!l) return null;
      l.usedAt = now;
      return { userId: l.userId, source: l.source };
    },
  };
  const audit = { recordWithoutContext: async (_c: string, _u: string, e: { description: string }) => void audits.push(e.description) } as unknown as AuditService;
  const create = new CreateLoginLinkUseCase(userRepo, linkRepo, () => clock.now);
  const login = new LoginWithLinkUseCase(userRepo, linkRepo, audit, () => clock.now);
  return { create, login, links, clock, refreshTokens, audits };
}

describe("enlace de entrada de un solo uso (boton Entrar a Contapro)", () => {
  it("abre la misma sesion que el login con clave, y solo se guarda el hash del token", async () => {
    const { create, login, links, refreshTokens, audits } = setup();
    const { token, expiresAt } = await create.execute({ companyId: "co-1", email: " Ana@Correo.com ", source: "CAJAPRO" });

    expect(links[0]!.tokenHash).toBe(sha256(token));
    expect(links.some((l) => l.tokenHash === token)).toBe(false);
    expect(expiresAt.toISOString()).toBe("2026-11-02T15:05:00.000Z");

    const session = await login.execute({ token });
    expect(session.user).toMatchObject({ id: "u-1", companyId: "co-1", branchId: "br-1", permissions: ["sale.create"] });
    expect(session.accessToken).toBeTruthy();
    expect(refreshTokens).toHaveLength(1);
    expect(audits[0]).toContain("Entro desde Cajapro");
  });

  it("sirve una sola vez", async () => {
    const { create, login } = setup();
    const { token } = await create.execute({ companyId: "co-1", email: "ana@correo.com", source: "CAJAPRO" });
    await login.execute({ token });
    await expect(login.execute({ token })).rejects.toThrow(/vencio o ya se uso/);
  });

  it("vence a los 5 minutos", async () => {
    const { create, login, clock } = setup();
    const { token } = await create.execute({ companyId: "co-1", email: "ana@correo.com", source: "CAJAPRO" });
    clock.now = new Date("2026-11-02T15:05:01Z");
    await expect(login.execute({ token })).rejects.toThrow(/vencio o ya se uso/);
  });

  it("un token inventado no entra", async () => {
    const { login } = setup();
    await expect(login.execute({ token: "x".repeat(43) })).rejects.toThrow(/vencio o ya se uso/);
  });

  it("no se crea para un correo que no es de esa empresa, ni para un usuario inactivo", async () => {
    await expect(setup().create.execute({ companyId: "co-2", email: "ana@correo.com", source: "CAJAPRO" })).rejects.toThrow();
    await expect(setup({ ...ana, isActive: false }).create.execute({ companyId: "co-1", email: "ana@correo.com", source: "CAJAPRO" })).rejects.toThrow();
  });

  it("una empresa archivada no entra, ni con el enlace", async () => {
    const { create, login } = setup({ ...ana, companyIsActive: false });
    const { token } = await create.execute({ companyId: "co-1", email: "ana@correo.com", source: "CAJAPRO" });
    await expect(login.execute({ token })).rejects.toThrow(/archivada/);
  });
});
