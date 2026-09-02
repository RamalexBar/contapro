import { describe, expect, it } from "vitest";
import type { ICustomerRepository, CustomerRecord } from "../../../customers/domain/customer.repository";
import type { IPriceListRepository, PriceListRecord } from "../domain/price-list.repository";
import { resolveEffectivePriceListId } from "./resolve-effective-price-list-id";

const CUSTOMER_NO_LIST: CustomerRecord = {
  id: "customer-1",
  documentType: "CC",
  documentNumber: "123",
  name: "Cliente sin lista",
  email: null,
  phone: null,
  creditLimit: 0,
  currentBalance: 0,
  isActive: true,
  priceListId: null,
  municipalityCode: null,
  address: null,
  dianIdentityDocumentId: null,
  dianTypeOrganizationId: null,
  dianTaxRegimeId: null,
  dianTaxLevelId: null,
  dianCountryId: null,
  dianCityId: null,
  dianPostalCode: null,
};

const CUSTOMER_WITH_LIST: CustomerRecord = { ...CUSTOMER_NO_LIST, id: "customer-2", priceListId: "pl-wholesale" };

class FakeCustomerRepository implements Partial<ICustomerRepository> {
  private customers = [CUSTOMER_NO_LIST, CUSTOMER_WITH_LIST];
  async findByIdOrThrow(id: string): Promise<CustomerRecord> {
    const found = this.customers.find((c) => c.id === id);
    if (!found) throw new Error("not found");
    return found;
  }
}

const WHOLESALE_LIST: PriceListRecord = { id: "pl-wholesale", code: "MAYORISTA", name: "Mayorista", isActive: true };
const INACTIVE_LIST: PriceListRecord = { id: "pl-inactive", code: "VIEJA", name: "Vieja", isActive: false };

class FakePriceListRepository implements Partial<IPriceListRepository> {
  private lists = [WHOLESALE_LIST, INACTIVE_LIST];
  async findByIdOrThrow(id: string): Promise<PriceListRecord> {
    const found = this.lists.find((l) => l.id === id);
    if (!found) throw new Error("not found");
    return found;
  }
}

function makeDeps() {
  return {
    customerRepo: new FakeCustomerRepository() as unknown as ICustomerRepository,
    priceListRepo: new FakePriceListRepository() as unknown as IPriceListRepository,
  };
}

describe("resolveEffectivePriceListId", () => {
  it("returns null when there is neither an explicit list nor a customer", async () => {
    const { customerRepo, priceListRepo } = makeDeps();
    const result = await resolveEffectivePriceListId(customerRepo, priceListRepo, undefined, undefined);
    expect(result).toBeNull();
  });

  it("returns null when the customer has no assigned price list", async () => {
    const { customerRepo, priceListRepo } = makeDeps();
    const result = await resolveEffectivePriceListId(customerRepo, priceListRepo, undefined, "customer-1");
    expect(result).toBeNull();
  });

  it("resolves the customer's assigned list when no explicit list is given", async () => {
    const { customerRepo, priceListRepo } = makeDeps();
    const result = await resolveEffectivePriceListId(customerRepo, priceListRepo, undefined, "customer-2");
    expect(result).toBe("pl-wholesale");
  });

  it("the explicit list wins over the customer's assigned list", async () => {
    const { customerRepo, priceListRepo } = makeDeps();
    const result = await resolveEffectivePriceListId(customerRepo, priceListRepo, "pl-wholesale", "customer-1");
    expect(result).toBe("pl-wholesale");
  });

  it("rejects an inactive price list", async () => {
    const { customerRepo, priceListRepo } = makeDeps();
    await expect(
      resolveEffectivePriceListId(customerRepo, priceListRepo, "pl-inactive", undefined)
    ).rejects.toThrow(/inactiva/);
  });
});
