import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../../shared/context/request-context";
import type { ICustomerRepository, CustomerRecord } from "../../../../customers/domain/customer.repository";
import type { IPriceListRepository, PriceListRecord } from "../../../../inventory/price-list/domain/price-list.repository";
import type { CreateQuoteData, IQuoteRepository, QuoteRecord } from "../../domain/quote.repository";
import { CreateQuoteUseCase } from "./create-quote.use-case";

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
const VIP_LIST: PriceListRecord = { id: "pl-vip", code: "VIP", name: "VIP", isActive: true };

class FakePriceListRepository implements Partial<IPriceListRepository> {
  private lists = [WHOLESALE_LIST, VIP_LIST];
  async findByIdOrThrow(id: string): Promise<PriceListRecord> {
    const found = this.lists.find((l) => l.id === id);
    if (!found) throw new Error("not found");
    return found;
  }
}

class FakeQuoteRepository implements Partial<IQuoteRepository> {
  created: CreateQuoteData[] = [];
  async create(data: CreateQuoteData): Promise<QuoteRecord> {
    this.created.push(data);
    return {
      id: "quote-1",
      status: "OPEN",
      subtotal: 0,
      total: 0,
      validUntil: data.validUntil,
      createdAt: new Date("2026-08-06"),
      priceListId: data.priceListId,
    };
  }
}

function withTenantContext<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run(
    { companyId: "company-1", branchId: null, userId: "user-1", roles: [], permissions: new Set() },
    fn
  );
}

function makeUseCase() {
  const repo = new FakeQuoteRepository();
  const useCase = new CreateQuoteUseCase(
    repo as unknown as IQuoteRepository,
    new FakeCustomerRepository() as unknown as ICustomerRepository,
    new FakePriceListRepository() as unknown as IPriceListRepository
  );
  return { useCase, repo };
}

const BASE_INPUT = {
  branchId: "branch-1",
  validUntil: new Date("2026-09-01"),
  items: [{ productId: "product-1", quantity: 2, discountPercent: 0 }],
};

describe("CreateQuoteUseCase — listas de precios (item 35 de docs/ALCANCE.md)", () => {
  it("regression: sin priceListId ni cliente con lista asignada, resuelve null (precio base)", async () => {
    const { useCase, repo } = makeUseCase();

    await withTenantContext(() => useCase.execute(BASE_INPUT));

    expect(repo.created[0].priceListId).toBeNull();
  });

  it("resuelve la lista explicita del request", async () => {
    const { useCase, repo } = makeUseCase();

    await withTenantContext(() => useCase.execute({ ...BASE_INPUT, priceListId: "pl-vip" }));

    expect(repo.created[0].priceListId).toBe("pl-vip");
  });

  it("resuelve automaticamente la lista asignada al cliente cuando no viene priceListId explicito", async () => {
    const { useCase, repo } = makeUseCase();

    await withTenantContext(() => useCase.execute({ ...BASE_INPUT, customerId: "customer-2" }));

    expect(repo.created[0].priceListId).toBe("pl-wholesale");
  });

  it("priceListId explicito gana sobre la lista asignada al cliente", async () => {
    const { useCase, repo } = makeUseCase();

    await withTenantContext(() =>
      useCase.execute({ ...BASE_INPUT, customerId: "customer-2", priceListId: "pl-vip" })
    );

    expect(repo.created[0].priceListId).toBe("pl-vip");
  });
});
