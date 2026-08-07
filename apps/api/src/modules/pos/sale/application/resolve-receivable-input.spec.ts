import { describe, expect, it } from "vitest";
import { resolveReceivableInput } from "./resolve-receivable-input";

describe("resolveReceivableInput", () => {
  it("returns null when there is no CREDIT payment", () => {
    const result = resolveReceivableInput([{ method: "CASH", amount: 100_000 }], "customer-1", undefined);
    expect(result).toBeNull();
  });

  it("returns null when the venta has no payments at all", () => {
    expect(resolveReceivableInput([], "customer-1", undefined)).toBeNull();
  });

  it("throws when there is a CREDIT payment but no customerId", () => {
    expect(() => resolveReceivableInput([{ method: "CREDIT", amount: 50_000 }], undefined, undefined)).toThrow(
      /requiere un cliente asociado/
    );
  });

  it("sums multiple CREDIT payments and defaults the due date to +30 days", () => {
    const before = new Date();
    const result = resolveReceivableInput(
      [
        { method: "CASH", amount: 20_000 },
        { method: "CREDIT", amount: 30_000 },
        { method: "CREDIT", amount: 15_000 },
      ],
      "customer-1",
      undefined
    );

    expect(result).not.toBeNull();
    expect(result!.customerId).toBe("customer-1");
    expect(result!.amount).toBe(45_000);

    const expectedMin = new Date(before);
    expectedMin.setDate(expectedMin.getDate() + 29);
    const expectedMax = new Date(before);
    expectedMax.setDate(expectedMax.getDate() + 31);
    expect(result!.dueDate.getTime()).toBeGreaterThan(expectedMin.getTime());
    expect(result!.dueDate.getTime()).toBeLessThan(expectedMax.getTime());
  });

  it("uses the explicit dueDate when provided instead of the default", () => {
    const explicitDueDate = new Date("2026-09-15");
    const result = resolveReceivableInput([{ method: "CREDIT", amount: 10_000 }], "customer-1", explicitDueDate);
    expect(result!.dueDate).toBe(explicitDueDate);
  });
});
