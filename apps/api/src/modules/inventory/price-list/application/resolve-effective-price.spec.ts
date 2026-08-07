import { describe, expect, it } from "vitest";
import type { IPriceListRepository } from "../domain/price-list.repository";
import { resolveEffectivePrice } from "./resolve-effective-price";

class FakePriceListRepository implements Partial<IPriceListRepository> {
  /** productId -> priceListId -> price */
  overrides: Record<string, Record<string, number>> = {
    "product-1": { "pl-wholesale": 4000 },
  };
  async findProductPrice(priceListId: string, productId: string): Promise<number | null> {
    return this.overrides[productId]?.[priceListId] ?? null;
  }
}

describe("resolveEffectivePrice", () => {
  it("returns the base price when there is no effective price list", async () => {
    const repo = new FakePriceListRepository();
    const price = await resolveEffectivePrice(repo as unknown as IPriceListRepository, null, "product-1", 5000);
    expect(price).toBe(5000);
  });

  it("returns the list's override when one exists for the product", async () => {
    const repo = new FakePriceListRepository();
    const price = await resolveEffectivePrice(repo as unknown as IPriceListRepository, "pl-wholesale", "product-1", 5000);
    expect(price).toBe(4000);
  });

  it("falls back to the base price when the list has no override for the product", async () => {
    const repo = new FakePriceListRepository();
    const price = await resolveEffectivePrice(repo as unknown as IPriceListRepository, "pl-vip", "product-1", 5000);
    expect(price).toBe(5000);
  });
});
