import { describe, expect, it } from "vitest";
import type { AuditService } from "../../../audit/application/audit.service";
import type { PostBenefitSettlementJournalEntryUseCase } from "../../../accounting/application/use-cases/post-benefit-settlement-journal-entry.use-case";
import type { EmployeeRecord, IEmployeeRepository } from "../../../employees/domain/employee.repository";
import type {
  BenefitSettlementRecord,
  BenefitSettlementType,
  CreateBenefitSettlementData,
  IBenefitSettlementRepository,
} from "../../domain/benefit-settlement.repository";
import type { IPayrollParameterRepository, PayrollParameterRecord } from "../../domain/payroll-parameter.repository";
import { SettleBenefitsUseCase } from "./settle-benefits.use-case";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const PARAM = { year: 2026, minimumWage: 1_750_905, transportAllowance: 249_095, uvt: 52_374 } as PayrollParameterRecord;

function employee(overrides: Partial<EmployeeRecord>): EmployeeRecord {
  return {
    firstName: "X",
    lastName: "Y",
    documentNumber: "1",
    baseSalary: 1_750_905,
    hireDate: d("2025-01-10"),
    terminationDate: null,
    contractType: "INDEFINITE",
    salaryType: "ORDINARY",
    ...overrides,
  } as EmployeeRecord;
}

class FakeRepo implements IBenefitSettlementRepository {
  saved: Array<CreateBenefitSettlementData & { journalEntryId: string | null }> = [];
  async approvedPayrollTotals() {
    return { variableEarnings: 0, provisions: { SERVICE_BONUS: 900_000, SEVERANCE: 1_500_000, SEVERANCE_INTEREST: 150_000, VACATION: 1_000_000 } };
  }
  async vacationDaysTaken() {
    return 15;
  }
  async exists(employeeId: string, type: BenefitSettlementType, periodStart: Date) {
    return this.saved.some(
      (s) => s.settlement.employeeId === employeeId && s.type === type && (type === "TERMINATION" || s.periodStart.getTime() === periodStart.getTime())
    );
  }
  async createMany(rows: CreateBenefitSettlementData[], journalEntryId: string | null) {
    this.saved.push(...rows.map((r) => ({ ...r, journalEntryId })));
    return rows.map((r) => ({ id: r.settlement.employeeId, type: r.type }) as unknown as BenefitSettlementRecord);
  }
  async list() {
    return [];
  }
  async findByIdOrThrow(): Promise<BenefitSettlementRecord> {
    throw new Error("not used");
  }
}

function setup(employees: EmployeeRecord[]) {
  const repo = new FakeRepo();
  const journals: unknown[] = [];
  const useCase = new SettleBenefitsUseCase(
    repo,
    {
      listActiveForPeriod: async () => employees,
      findByIdOrThrow: async (id: string) => employees.find((e) => e.id === id)!,
    } as unknown as IEmployeeRepository,
    { findByYearOrThrow: async () => PARAM } as unknown as IPayrollParameterRepository,
    {
      execute: async (input: unknown) => {
        journals.push(input);
        return { id: "je-1" };
      },
    } as unknown as PostBenefitSettlementJournalEntryUseCase,
    { record: async () => undefined } as unknown as AuditService
  );
  return { repo, journals, useCase };
}

describe("SettleBenefitsUseCase", () => {
  it("pays the semester prima, skipping integral salaries and people who left in the semester", async () => {
    const { repo, journals, useCase } = setup([
      employee({ id: "a", firstName: "Ana" }),
      employee({ id: "b", firstName: "Beto", salaryType: "INTEGRAL", baseSalary: 25_000_000 }),
      employee({ id: "c", firstName: "Caro", terminationDate: d("2026-09-30") }),
    ]);

    const preview = await useCase.preview({ type: "SERVICE_BONUS", year: 2026, semester: 2 });
    expect(preview.settlements.map((s) => s.employeeId)).toEqual(["a"]);
    expect(preview.settlements[0].grossTotal).toBe(1_000_000);
    expect(preview.skipped).toHaveLength(2);

    await useCase.execute({ type: "SERVICE_BONUS", year: 2026, semester: 2 });
    expect(repo.saved).toHaveLength(1);
    expect(repo.saved[0].journalEntryId).toBe("je-1");
    expect(journals).toHaveLength(1);

    // No se puede pagar dos veces el mismo semestre.
    await expect(useCase.execute({ type: "SERVICE_BONUS", year: 2026, semester: 2 })).rejects.toThrow(/No hay nada para liquidar/);
  });

  it("annual cesantias go to the fund; only the interest is paid to the worker", async () => {
    const { useCase } = setup([employee({ id: "a" })]);
    const preview = await useCase.preview({ type: "SEVERANCE", year: 2026 });
    const s = preview.settlements[0];
    expect(s.toSeveranceFund).toBe(2_000_000);
    expect(s.netPay).toBe(240_000);
  });

  it("final settlement for a dismissal without just cause, once only", async () => {
    const { useCase } = setup([employee({ id: "a", terminationDate: d("2026-11-15") })]);
    const preview = await useCase.preview({ type: "TERMINATION", employeeId: "a", reason: "WITHOUT_JUST_CAUSE" });
    const concepts = preview.settlements[0].lines.map((l) => l.concept);
    expect(concepts).toEqual(["SEVERANCE", "SEVERANCE_INTEREST", "SERVICE_BONUS", "VACATION", "INDEMNITY"]);
    // Cesantias 2026 hasta el 15/11: 315 dias de base 2,000,000.
    expect(preview.settlements[0].lines[0].amount).toBe(1_750_000);

    await useCase.execute({ type: "TERMINATION", employeeId: "a", reason: "WITHOUT_JUST_CAUSE" });
    await expect(useCase.preview({ type: "TERMINATION", employeeId: "a", reason: "WITHOUT_JUST_CAUSE" })).rejects.toThrow(/ya tiene su liquidacion/);
  });

  it("requires the termination date before settling a contract", async () => {
    const { useCase } = setup([employee({ id: "a" })]);
    await expect(useCase.preview({ type: "TERMINATION", employeeId: "a", reason: "RESIGNATION" })).rejects.toThrow(/fecha de retiro/);
  });
});
