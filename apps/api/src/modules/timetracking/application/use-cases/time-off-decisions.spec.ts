import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { IEmployeeRepository } from "../../../employees/domain/employee.repository";
import type { ITimeOffRepository, TimeOffDecision, VacationRecord } from "../../domain/time-off.repository";
import { ApproveTimeOffUseCase } from "./approve-time-off.use-case";
import { RejectTimeOffUseCase } from "./reject-time-off.use-case";
import { TimeOffNotificationsUseCase } from "./time-off-notifications.use-case";

function vacation(overrides: Partial<VacationRecord> = {}): VacationRecord {
  return {
    id: "v1",
    employeeId: "emp-1",
    startDate: new Date("2026-11-02T00:00:00Z"),
    endDate: new Date("2026-11-06T00:00:00Z"),
    daysTaken: 5,
    status: "REQUESTED",
    approvedByUserId: null,
    requestedStartDate: null,
    requestedEndDate: null,
    decisionNote: null,
    decidedAt: null,
    decisionSeenAt: null,
    createdAt: new Date("2026-10-12T00:00:00Z"),
    ...overrides,
  };
}

class FakeTimeOffRepository {
  vacations = new Map<string, VacationRecord>([["v1", vacation()]]);
  async findVacationByIdOrThrow(id: string) {
    return this.vacations.get(id)!;
  }
  async decideVacation(id: string, d: TimeOffDecision) {
    const current = this.vacations.get(id)!;
    const datesChanged = Boolean(d.startDate || d.endDate);
    const updated: VacationRecord = {
      ...current,
      status: d.status,
      approvedByUserId: d.approvedByUserId ?? null,
      decisionNote: d.note ?? null,
      decidedAt: new Date(),
      decisionSeenAt: null,
      ...(d.daysTaken ? { daysTaken: d.daysTaken } : {}),
      ...(datesChanged
        ? { requestedStartDate: current.startDate, requestedEndDate: current.endDate, startDate: d.startDate ?? current.startDate, endDate: d.endDate ?? current.endDate }
        : {}),
    };
    this.vacations.set(id, updated);
    return updated;
  }
  async countPending() {
    return { vacations: [...this.vacations.values()].filter((v) => v.status === "REQUESTED").length, leavePermissions: 1, sickLeaves: 0 };
  }
  async listUnseenDecisions(employeeId: string) {
    return [...this.vacations.values()]
      .filter((v) => v.employeeId === employeeId && v.decidedAt && !v.decisionSeenAt)
      .map((v) => ({ ...v, kind: "vacation" as const, decidedAt: v.decidedAt! }));
  }
  async markDecisionsSeen(employeeId: string) {
    for (const v of this.vacations.values()) if (v.employeeId === employeeId && v.decidedAt) v.decisionSeenAt = new Date();
  }
}

class FakeAuditLogRepository implements IAuditLogRepository {
  entries: CreateAuditLogInput[] = [];
  async create(input: CreateAuditLogInput): Promise<AuditLogEntry> {
    this.entries.push(input);
    return { id: "a", metadata: null, createdAt: new Date(), ...input };
  }
  async list(): Promise<AuditLogEntry[]> {
    return [];
  }
}

const run = <T,>(userId: string, permissions: string[], fn: () => Promise<T>) =>
  tenantStorage.run({ companyId: "c1", branchId: null, userId, roles: [], permissions: new Set(permissions) }, fn);

function setup() {
  const repo = new FakeTimeOffRepository();
  const auditRepo = new FakeAuditLogRepository();
  const audit = new AuditService(auditRepo);
  const employees = {
    findByUserId: async (userId: string) => (userId === "user-cajero" ? { id: "emp-1" } : null),
  } as unknown as IEmployeeRepository;
  return {
    repo,
    auditRepo,
    approve: new ApproveTimeOffUseCase(repo as unknown as ITimeOffRepository, audit),
    reject: new RejectTimeOffUseCase(repo as unknown as ITimeOffRepository, audit),
    notifications: new TimeOffNotificationsUseCase(repo as unknown as ITimeOffRepository, employees),
  };
}

describe("Aprobar y rechazar solicitudes", () => {
  it("approves with other dates, keeping the requested ones and the new days", async () => {
    const { approve, auditRepo } = setup();

    const result = (await run("admin", ["timeoff.manage"], () =>
      approve.execute("vacation", "v1", {
        startDate: new Date("2026-11-09T00:00:00Z"),
        endDate: new Date("2026-11-13T00:00:00Z"),
        daysTaken: 5,
        note: "Esa semana hay inventario",
      })
    )) as VacationRecord;

    expect(result).toMatchObject({ status: "APPROVED", decisionNote: "Esa semana hay inventario" });
    expect(result.startDate.toISOString().slice(0, 10)).toBe("2026-11-09");
    expect(result.requestedStartDate?.toISOString().slice(0, 10)).toBe("2026-11-02");
    expect(auditRepo.entries[0]?.description).toContain("pedida del 2026-11-02 al 2026-11-06");
  });

  it("rejects approving with an end date before the start", async () => {
    const { approve } = setup();
    await expect(
      run("admin", ["timeoff.manage"], () => approve.execute("vacation", "v1", { startDate: new Date("2026-11-10"), endDate: new Date("2026-11-05") }))
    ).rejects.toThrow(/no puede ser anterior/);
  });

  it("requires a reason to reject, and saves it", async () => {
    const { reject } = setup();
    await expect(run("admin", ["timeoff.manage"], () => reject.execute("vacation", "v1", "  "))).rejects.toThrow(/motivo del rechazo/);

    const result = await run("admin", ["timeoff.manage"], () => reject.execute("vacation", "v1", "Hay mucho trabajo"));
    expect(result).toMatchObject({ status: "REJECTED", decisionNote: "Hay mucho trabajo" });
  });

  it("does not decide twice", async () => {
    const { approve, reject } = setup();
    await run("admin", ["timeoff.manage"], () => approve.execute("vacation", "v1"));
    await expect(run("admin", ["timeoff.manage"], () => reject.execute("vacation", "v1", "Tarde"))).rejects.toThrow(/ya esta aprobada/);
  });
});

describe("TimeOffNotificationsUseCase", () => {
  it("shows pending counts only to who approves", async () => {
    const { notifications } = setup();
    expect((await run("admin", ["timeoff.manage"], () => notifications.execute())).pending).toEqual({
      vacations: 1,
      leavePermissions: 1,
      sickLeaves: 0,
      total: 2,
    });
    expect((await run("user-cajero", ["timeoff.request"], () => notifications.execute())).pending).toBeNull();
  });

  it("shows the employee the answer until they mark it as seen", async () => {
    const { approve, notifications } = setup();
    await run("admin", ["timeoff.manage"], () => approve.execute("vacation", "v1"));

    const before = await run("user-cajero", ["timeoff.request"], () => notifications.execute());
    expect(before.decisions).toHaveLength(1);
    expect(before.decisions[0]).toMatchObject({ kind: "vacation", status: "APPROVED" });

    await run("user-cajero", ["timeoff.request"], () => notifications.markSeen());
    expect((await run("user-cajero", ["timeoff.request"], () => notifications.execute())).decisions).toHaveLength(0);
  });
});
