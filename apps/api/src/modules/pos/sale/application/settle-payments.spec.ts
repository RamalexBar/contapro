import { describe, expect, it } from "vitest";
import { settlePayments } from "./settle-payments";

describe("settlePayments", () => {
  it("keeps exact payments as they are", () => {
    expect(settlePayments([{ method: "CASH", amount: 23_562 }], 23_562)).toEqual({ payments: [{ method: "CASH", amount: 23_562 }], change: 0 });
  });

  it("takes the change out of the cash (the customer paid with a 50.000 bill)", () => {
    expect(settlePayments([{ method: "CASH", amount: 50_000 }], 23_562)).toEqual({ payments: [{ method: "CASH", amount: 23_562 }], change: 26_438 });
  });

  it("with mixed payments only the cash is reduced", () => {
    expect(
      settlePayments(
        [
          { method: "CARD", amount: 20_000 },
          { method: "CASH", amount: 10_000 },
        ],
        23_562
      )
    ).toEqual({ payments: [{ method: "CARD", amount: 20_000 }, { method: "CASH", amount: 3_562 }], change: 6_438 });
  });

  it("covers the mobile app rounding the total up to the peso", () => {
    expect(settlePayments([{ method: "CASH", amount: 8_497 }], 8_496.6).payments).toEqual([{ method: "CASH", amount: 8_496.6 }]);
  });

  it("rejects an overpayment that is not cash (no change can be given on a card)", () => {
    expect(() => settlePayments([{ method: "CARD", amount: 30_000 }], 23_562)).toThrow(/no es efectivo/);
  });
});
