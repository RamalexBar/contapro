import { describe, expect, it } from "vitest";
import { verifySecret } from "../../../auth/infrastructure/password-hasher.service";
import type { IPlatformAdminRepository, PlatformAdminRecord, PlatformAdminSummary } from "../../domain/platform-admin.repository";
import { CreatePlatformAdminUseCase } from "./create-platform-admin.use-case";
import { SetPlatformAdminActiveUseCase } from "./set-platform-admin-active.use-case";

type Row = PlatformAdminRecord & { createdAt: Date };

class FakePlatformAdminRepo implements IPlatformAdminRepository {
  rows: Row[] = [];

  private summary(r: Row): PlatformAdminSummary {
    return { id: r.id, email: r.email, fullName: r.fullName, isActive: r.isActive, createdAt: r.createdAt };
  }
  async findByEmail(email: string) {
    return this.rows.find((r) => r.email === email) ?? null;
  }
  async findByIdOrThrow(id: string) {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new Error("not found");
    return row;
  }
  async list() {
    return this.rows.map((r) => this.summary(r));
  }
  async create(input: { email: string; passwordHash: string; fullName: string }) {
    const row: Row = { id: "pa-" + (this.rows.length + 1), isActive: true, createdAt: new Date(), ...input };
    this.rows.push(row);
    return this.summary(row);
  }
  async setActive(id: string, isActive: boolean) {
    const row = await this.findByIdOrThrow(id);
    row.isActive = isActive;
    return this.summary(row);
  }
}

describe("CreatePlatformAdminUseCase", () => {
  it("stores a hashed password and a normalized email, never returning the hash", async () => {
    const repo = new FakePlatformAdminRepo();
    const created = await new CreatePlatformAdminUseCase(repo).execute({
      email: "  Hijo@Correo.com ",
      password: "ClaveSegura123",
      fullName: " Juan Barrios ",
    });

    expect(created).toMatchObject({ email: "hijo@correo.com", fullName: "Juan Barrios", isActive: true });
    expect(created).not.toHaveProperty("passwordHash");
    expect(repo.rows[0].passwordHash).not.toBe("ClaveSegura123");
    expect(await verifySecret("ClaveSegura123", repo.rows[0].passwordHash)).toBe(true);
  });

  it("rejects an email that already belongs to another operator", async () => {
    const useCase = new CreatePlatformAdminUseCase(new FakePlatformAdminRepo());
    await useCase.execute({ email: "a@b.com", password: "ClaveSegura123", fullName: "A" });
    await expect(useCase.execute({ email: "A@B.com", password: "OtraClave123", fullName: "B" })).rejects.toThrow(/Ya existe/);
  });
});

describe("SetPlatformAdminActiveUseCase", () => {
  it("deactivates another operator but never the one making the request", async () => {
    const repo = new FakePlatformAdminRepo();
    const create = new CreatePlatformAdminUseCase(repo);
    const me = await create.execute({ email: "yo@b.com", password: "ClaveSegura123", fullName: "Yo" });
    const other = await create.execute({ email: "otro@b.com", password: "ClaveSegura123", fullName: "Otro" });
    const useCase = new SetPlatformAdminActiveUseCase(repo);

    await expect(useCase.execute({ id: me.id, isActive: false, requestedBy: me.id })).rejects.toThrow(/propio acceso/);
    expect((await useCase.execute({ id: other.id, isActive: false, requestedBy: me.id })).isActive).toBe(false);
    expect((await useCase.execute({ id: other.id, isActive: true, requestedBy: me.id })).isActive).toBe(true);
  });
});
