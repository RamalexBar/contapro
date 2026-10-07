import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../../shared/context/request-context";
import { AuditService } from "../../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../../audit/domain/audit-log.repository";
import type { CategoryRecord, ICategoryRepository } from "../../../category/domain/category.repository";
import { Product } from "../../domain/product.entity";
import type { CreateProductData, IProductRepository, ProductListItem } from "../../domain/product.repository";
import { CreateProductUseCase } from "./create-product.use-case";
import { ImportProductsUseCase } from "./import-products.use-case";

class FakeProductRepository implements IProductRepository {
  created: CreateProductData[] = [];
  constructor(private readonly takenSkus: string[] = [], private readonly takenBarcodes: string[] = []) {}

  async create(data: CreateProductData): Promise<Product> {
    if (data.sku === "RACE-1") throw new Error("Ya existe un producto con ese SKU o codigo de barras");
    this.created.push(data);
    return Product.fromPersistence({
      id: `prod-${this.created.length}`,
      companyId: "company-1",
      sku: data.sku,
      name: data.name,
      description: null,
      categoryId: data.categoryId ?? null,
      brandId: null,
      unit: data.unit ?? "UN",
      currentCost: data.currentCost,
      currentPrice: data.currentPrice,
      taxRate: data.taxRate ?? 19,
      isActive: true,
    });
  }
  async listTakenIdentifiers() {
    return { skus: this.takenSkus, barcodes: this.takenBarcodes };
  }
  async findById(): Promise<Product | null> {
    return null;
  }
  async findByIdOrThrow(): Promise<Product> {
    throw new Error("not used");
  }
  async findByBarcode(): Promise<Product | null> {
    return null;
  }
  async list(): Promise<ProductListItem[]> {
    return [];
  }
  async updateBasicInfo(): Promise<Product> {
    throw new Error("not used");
  }
  async savePriceAndCost(): Promise<Product> {
    throw new Error("not used");
  }
  async updateBarcode(): Promise<void> {}
  async softDelete(): Promise<void> {}
}

class FakeCategoryRepository implements ICategoryRepository {
  categories: CategoryRecord[] = [
    { id: "cat-bebidas", companyId: "company-1", name: "Bebidas", parentId: null, isActive: true },
  ];
  async list(): Promise<CategoryRecord[]> {
    return this.categories;
  }
  async create(name: string): Promise<CategoryRecord> {
    const category = { id: `cat-${this.categories.length + 1}`, companyId: "company-1", name, parentId: null, isActive: true };
    this.categories.push(category);
    return category;
  }
  async findById(id: string): Promise<CategoryRecord | null> {
    return this.categories.find((c) => c.id === id) ?? null;
  }
}

class FakeAuditLogRepository implements IAuditLogRepository {
  entries: CreateAuditLogInput[] = [];
  async create(input: CreateAuditLogInput): Promise<AuditLogEntry> {
    this.entries.push(input);
    return { id: `audit-${this.entries.length}`, metadata: input.metadata ?? null, createdAt: new Date(), ...input };
  }
  async list(): Promise<AuditLogEntry[]> {
    return [];
  }
}

function makeUseCase(taken: { skus?: string[]; barcodes?: string[] } = {}) {
  const productRepo = new FakeProductRepository(taken.skus, taken.barcodes);
  const categoryRepo = new FakeCategoryRepository();
  const auditRepo = new FakeAuditLogRepository();
  const useCase = new ImportProductsUseCase(
    productRepo,
    categoryRepo,
    new CreateProductUseCase(productRepo, new AuditService(auditRepo))
  );
  return { useCase, productRepo, categoryRepo, auditRepo };
}

function run<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run(
    { companyId: "company-1", branchId: "branch-1", userId: "user-1", roles: [], permissions: new Set() },
    fn
  );
}

describe("ImportProductsUseCase", () => {
  it("crea todos los productos con stock inicial, IVA por defecto y una auditoria por producto", async () => {
    const { useCase, productRepo, auditRepo } = makeUseCase();
    const result = await run(() =>
      useCase.execute(
        {
          rows: [
            { name: "Gaseosa 400ml", sku: "GAS-400", barcode: "7702004003", price: 3000, cost: 1800, initialStock: 24 },
            { name: "Pan tajado", price: 5500, taxRate: 5 },
          ],
          pricesIncludeTax: false,
          dryRun: false,
        },
        "branch-1"
      )
    );

    expect(result).toMatchObject({ totalRows: 2, validRows: 2, created: 2, errors: [] });
    expect(productRepo.created[0]).toMatchObject({ sku: "GAS-400", barcode: "7702004003", initialStock: 24, taxRate: 19, branchId: "branch-1" });
    expect(productRepo.created[1]).toMatchObject({ sku: "PROD-0001", currentCost: 0, initialStock: 0, taxRate: 5, unit: "UN" });
    expect(auditRepo.entries.filter((e) => e.action === "PRODUCT_CREATED")).toHaveLength(2);
  });

  it("no crea nada si una sola fila tiene error, y reporta cada error con su numero de fila de Excel", async () => {
    const { useCase, productRepo } = makeUseCase({ skus: ["EXISTE-1"], barcodes: ["999"] });
    const result = await run(() =>
      useCase.execute(
        {
          rows: [
            { name: "Valido", price: 1000 },
            { name: "", price: 1000 },
            { name: "Sin precio" },
            { name: "Referencia ocupada", sku: "existe-1", price: 1000 },
            { name: "Barras ocupado", barcode: "999", price: 1000 },
            { name: "Repetido A", sku: "R-1", price: 1000 },
            { name: "Repetido B", sku: "R-1", price: 1000 },
            { name: "Repetido y sin precio", sku: "R-1" },
            { name: "IVA raro", price: 1000, taxRate: 190 },
          ],
          pricesIncludeTax: false,
          dryRun: false,
        },
        "branch-1"
      )
    );

    expect(productRepo.created).toHaveLength(0);
    expect(result.created).toBe(0);
    expect(result.validRows).toBe(2);
    expect(result.errors.map((e) => e.rowNumber)).toEqual([3, 4, 5, 6, 8, 9, 10]);
    expect(result.errors.find((e) => e.rowNumber === 3)?.messages).toEqual(["Falta el nombre"]);
    expect(result.errors.find((e) => e.rowNumber === 4)?.messages).toEqual(["Falta el precio"]);
    expect(result.errors.find((e) => e.rowNumber === 5)?.messages[0]).toContain("ya existe en el sistema");
    expect(result.errors.find((e) => e.rowNumber === 8)?.messages[0]).toContain("repetida (fila 7)");
    // Una fila con varios problemas los reporta todos juntos, no solo el primero.
    expect(result.errors.find((e) => e.rowNumber === 9)?.messages).toEqual(["Falta el precio", "La referencia \"R-1\" esta repetida (fila 7)"]);
  });

  it("dryRun valida y anticipa categorias nuevas sin crear nada", async () => {
    const { useCase, productRepo, categoryRepo } = makeUseCase();
    const result = await run(() =>
      useCase.execute(
        {
          rows: [
            { name: "Agua", price: 2000, category: "bebidas" },
            { name: "Arroz", price: 4000, category: "Granos" },
            { name: "Frijol", price: 6000, category: "GRANOS" },
          ],
          pricesIncludeTax: false,
          dryRun: true,
        },
        "branch-1"
      )
    );

    expect(result).toMatchObject({ dryRun: true, validRows: 3, created: 0, categoriesCreated: ["Granos"] });
    expect(productRepo.created).toHaveLength(0);
    expect(categoryRepo.categories).toHaveLength(1);
  });

  it("crea las categorias faltantes una sola vez y reusa las existentes sin importar mayusculas", async () => {
    const { useCase, productRepo, categoryRepo } = makeUseCase();
    await run(() =>
      useCase.execute(
        {
          rows: [
            { name: "Agua", price: 2000, category: "BEBIDAS" },
            { name: "Arroz", price: 4000, category: "Granos" },
            { name: "Frijol", price: 6000, category: "granos" },
          ],
          pricesIncludeTax: false,
          dryRun: false,
        },
        "branch-1"
      )
    );

    expect(categoryRepo.categories.map((c) => c.name)).toEqual(["Bebidas", "Granos"]);
    expect(productRepo.created.map((p) => p.categoryId)).toEqual(["cat-bebidas", "cat-2", "cat-2"]);
  });

  it("si los precios incluyen IVA, guarda el precio base sin IVA", async () => {
    const { useCase, productRepo } = makeUseCase();
    await run(() =>
      useCase.execute(
        { rows: [{ name: "Gaseosa", price: 3570 }, { name: "Pan", price: 5250, taxRate: 5 }, { name: "Huevos", price: 1000, taxRate: 0 }], pricesIncludeTax: true, dryRun: false },
        "branch-1"
      )
    );

    expect(productRepo.created.map((p) => p.currentPrice)).toEqual([3000, 5000, 1000]);
  });

  it("las referencias generadas saltan las que ya existen en el sistema o en el archivo", async () => {
    const { useCase, productRepo } = makeUseCase({ skus: ["PROD-0001"] });
    await run(() =>
      useCase.execute(
        { rows: [{ name: "A", sku: "PROD-0002", price: 1 }, { name: "B", price: 1 }], pricesIncludeTax: false, dryRun: false },
        "branch-1"
      )
    );

    expect(productRepo.created.map((p) => p.sku)).toEqual(["PROD-0002", "PROD-0003"]);
  });

  it("usa los numeros de fila reales del archivo cuando el navegador los envia", async () => {
    const { useCase } = makeUseCase();
    const result = await run(() =>
      useCase.execute(
        { rows: [{ name: "A", price: 1 }, { name: "", price: 1 }], rowNumbers: [5, 9], pricesIncludeTax: false, dryRun: true },
        "branch-1"
      )
    );

    expect(result.errors).toEqual([{ rowNumber: 9, messages: ["Falta el nombre"] }]);
  });

  it("si una fila falla al crear (carrera con otro usuario), la reporta y sigue con las demas", async () => {
    const { useCase, productRepo } = makeUseCase();
    const result = await run(() =>
      useCase.execute(
        { rows: [{ name: "A", sku: "RACE-1", price: 1 }, { name: "B", price: 1 }], pricesIncludeTax: false, dryRun: false },
        "branch-1"
      )
    );

    expect(result.created).toBe(1);
    expect(productRepo.created).toHaveLength(1);
    expect(result.errors).toEqual([{ rowNumber: 2, messages: ["Ya existe un producto con ese SKU o codigo de barras"] }]);
  });
});
