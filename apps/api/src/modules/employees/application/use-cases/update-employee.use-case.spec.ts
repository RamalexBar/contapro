import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { EmployeeRecord, IEmployeeRepository, UpdateEmployeeData } from "../../domain/employee.repository";
import { UpdateEmployeeUseCase } from "./update-employee.use-case";

const employee = (id: string, firstName: string, userId: string | null) =>
  ({ id, firstName, lastName: "Perez", userId }) as unknown as EmployeeRecord;

class FakeEmployeeRepository {
  employees = [employee("e1", "Ana", null), employee("e2", "Luis", "user-luis")];
  users = new Set(["user-ana", "user-luis"]);
  async userExists(userId: string) {
    return this.users.has(userId);
  }
  async findByUserId(userId: string) {
    return this.employees.find((e) => e.userId === userId) ?? null;
  }
  async update(id: string, data: UpdateEmployeeData) {
    const current = this.employees.find((e) => e.id === id)!;
    const updated = { ...current, ...data } as EmployeeRecord;
    this.employees = this.employees.map((e) => (e.id === id ? updated : e));
    return updated;
  }
}

class FakeAuditLogRepository implements IAuditLogRepository {
  async create(input: CreateAuditLogInput): Promise<AuditLogEntry> {
    return { id: "a1", metadata: null, createdAt: new Date(), ...input };
  }
  async list(): Promise<AuditLogEntry[]> {
    return [];
  }
}

function run<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run({ companyId: "c1", branchId: null, userId: "admin", roles: [], permissions: new Set() }, fn);
}

function makeUseCase() {
  const repo = new FakeEmployeeRepository();
  return { repo, useCase: new UpdateEmployeeUseCase(repo as unknown as IEmployeeRepository, new AuditService(new FakeAuditLogRepository())) };
}

describe("UpdateEmployeeUseCase — vinculo con el usuario de Contapro", () => {
  it("links the employee to a user of the company", async () => {
    const { useCase } = makeUseCase();
    const result = await run(() => useCase.execute("e1", { userId: "user-ana" }));
    expect(result.userId).toBe("user-ana");
  });

  it("rejects a user already linked to another employee", async () => {
    const { useCase } = makeUseCase();
    await expect(run(() => useCase.execute("e1", { userId: "user-luis" }))).rejects.toThrow(/ya esta vinculado al empleado Luis Perez/);
  });

  it("rejects a user that does not exist in the company", async () => {
    const { useCase } = makeUseCase();
    await expect(run(() => useCase.execute("e1", { userId: "otro" }))).rejects.toThrow(/no existe en la empresa/);
  });

  it("allows unlinking with null", async () => {
    const { useCase } = makeUseCase();
    const result = await run(() => useCase.execute("e2", { userId: null }));
    expect(result.userId).toBeNull();
  });
});
