import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  IWebhookSubscriptionRepository,
  WebhookSubscriptionWithSecret,
} from "../domain/webhook-subscription.repository";
import type { IWebhookDeliveryRepository, RecordDeliveryData, WebhookDeliveryRecord } from "../domain/webhook-delivery.repository";
import { WebhookDispatcherService } from "./webhook-dispatcher.service";

const SUB_OK: WebhookSubscriptionWithSecret = {
  id: "sub-1",
  url: "https://ok.example.com/hook",
  eventTypes: ["sale.created"],
  secret: "secret-1",
  isActive: true,
  createdAt: new Date(),
};
const SUB_FAILING: WebhookSubscriptionWithSecret = {
  id: "sub-2",
  url: "https://failing.example.com/hook",
  eventTypes: ["sale.created"],
  secret: "secret-2",
  isActive: true,
  createdAt: new Date(),
};

class FakeSubscriptionRepository implements Partial<IWebhookSubscriptionRepository> {
  constructor(private readonly subscriptions: WebhookSubscriptionWithSecret[]) {}
  async listActiveForEvent(): Promise<WebhookSubscriptionWithSecret[]> {
    return this.subscriptions;
  }
  async findByIdWithSecret(id: string): Promise<WebhookSubscriptionWithSecret> {
    const found = this.subscriptions.find((s) => s.id === id);
    if (!found) throw new Error("not found");
    return found;
  }
}

class FakeDeliveryRepository implements Partial<IWebhookDeliveryRepository> {
  recorded: RecordDeliveryData[] = [];
  async record(data: RecordDeliveryData): Promise<WebhookDeliveryRecord> {
    this.recorded.push(data);
    return { id: `delivery-${this.recorded.length}`, attemptedAt: new Date(), ...data, errorMessage: data.errorMessage ?? null };
  }
}

function makeService(subscriptions: WebhookSubscriptionWithSecret[]) {
  const subscriptionRepo = new FakeSubscriptionRepository(subscriptions);
  const deliveryRepo = new FakeDeliveryRepository();
  const service = new WebhookDispatcherService(
    subscriptionRepo as unknown as IWebhookSubscriptionRepository,
    deliveryRepo as unknown as IWebhookDeliveryRepository
  );
  return { service, deliveryRepo };
}

describe("WebhookDispatcherService", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === SUB_OK.url) return new Response(null, { status: 200 });
        if (url === SUB_FAILING.url) return new Response(null, { status: 500 });
        throw new Error("network error");
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dispatches to every active subscription for the event and signs the body with HMAC-SHA256", async () => {
    const { service, deliveryRepo } = makeService([SUB_OK]);

    await service.dispatch("sale.created", { id: "sale-1", total: 100 });

    expect(fetch).toHaveBeenCalledWith(
      SUB_OK.url,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Webhook-Signature": expect.any(String) }),
      })
    );
    expect(deliveryRepo.recorded).toEqual([
      expect.objectContaining({ webhookSubscriptionId: "sub-1", eventType: "sale.created", success: true, responseStatus: 200 }),
    ]);
  });

  it("records a failed delivery when the endpoint responds with a non-2xx status, without throwing", async () => {
    const { service, deliveryRepo } = makeService([SUB_FAILING]);

    await service.dispatch("sale.created", { id: "sale-1" });

    expect(deliveryRepo.recorded).toEqual([
      expect.objectContaining({ webhookSubscriptionId: "sub-2", success: false, responseStatus: 500 }),
    ]);
  });

  it("a failing subscription does not prevent delivery to the others", async () => {
    const failingUrl: WebhookSubscriptionWithSecret = { ...SUB_FAILING, id: "sub-network-error", url: "https://unreachable.example.com" };
    const { service, deliveryRepo } = makeService([failingUrl, SUB_OK]);

    await service.dispatch("sale.created", { id: "sale-1" });

    const statuses = deliveryRepo.recorded.map((r) => ({ id: r.webhookSubscriptionId, success: r.success }));
    expect(statuses).toEqual([
      { id: "sub-network-error", success: false },
      { id: "sub-1", success: true },
    ]);
  });

  it("dispatchToSubscription sends to a single subscription by id, regardless of listActiveForEvent", async () => {
    const { service, deliveryRepo } = makeService([SUB_OK]);

    await service.dispatchToSubscription("sub-1", "sale.created", { id: "sale-1" });

    expect(deliveryRepo.recorded).toHaveLength(1);
    expect(deliveryRepo.recorded[0].webhookSubscriptionId).toBe("sub-1");
  });
});
