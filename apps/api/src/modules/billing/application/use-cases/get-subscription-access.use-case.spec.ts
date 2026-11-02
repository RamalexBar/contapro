import { describe, expect, it } from "vitest";
import type { IPlanRepository } from "../../../saas-admin/domain/plan.repository";
import type { ISubscriptionRepository, SubscriptionStatus } from "../../../saas-admin/domain/subscription.repository";
import { GetSubscriptionAccessUseCase } from "./get-subscription-access.use-case";

function makeUseCase(status: SubscriptionStatus | null, planCode = "PYME") {
  const state = { status, reads: 0, clock: 0 };
  const subscriptionRepo = {
    findLatestByCompanyId: async () => {
      state.reads++;
      return state.status
        ? { id: "s-1", planId: "p-1", status: state.status, currentPeriodEnd: new Date("2026-11-01"), graceEndsAt: new Date("2026-11-03") }
        : null;
    },
  } as unknown as ISubscriptionRepository;
  const planRepo = { findByIdOrThrow: async () => ({ id: "p-1", code: planCode }) } as unknown as IPlanRepository;
  const useCase = new GetSubscriptionAccessUseCase(subscriptionRepo, planRepo, () => state.clock);
  return { useCase, state };
}

describe("GetSubscriptionAccessUseCase", () => {
  it("only SUSPENDED and CANCELLED are read-only: a trial, an active plan and the grace period keep working", async () => {
    for (const [status, readOnly] of [
      ["TRIALING", false],
      ["ACTIVE", false],
      ["GRACE_PERIOD", false],
      ["SUSPENDED", true],
      ["CANCELLED", true],
    ] as const) {
      expect((await makeUseCase(status).useCase.execute("co-1"))?.readOnly).toBe(readOnly);
    }
  });

  it("tells when the plan is the Cajapro combo, which is renewed in Cajapro", async () => {
    expect(await makeUseCase("SUSPENDED", "COMBO_CAJAPRO_PYME").useCase.execute("co-1")).toMatchObject({ readOnly: true, billedByCajapro: true });
    expect(await makeUseCase("SUSPENDED", "PYME").useCase.execute("co-1")).toMatchObject({ billedByCajapro: false });
  });

  it("a company without a subscription is never blocked", async () => {
    expect(await makeUseCase(null).useCase.execute("co-1")).toBeNull();
  });

  it("keeps the answer 30 seconds per company, then reads it again (paying lifts the block within that time)", async () => {
    const { useCase, state } = makeUseCase("SUSPENDED");
    expect((await useCase.execute("co-1"))?.readOnly).toBe(true);

    state.status = "ACTIVE";
    state.clock = 29_000;
    expect((await useCase.execute("co-1"))?.readOnly).toBe(true);
    expect(state.reads).toBe(1);

    state.clock = 31_000;
    expect((await useCase.execute("co-1"))?.readOnly).toBe(false);
    expect(state.reads).toBe(2);
  });
});
