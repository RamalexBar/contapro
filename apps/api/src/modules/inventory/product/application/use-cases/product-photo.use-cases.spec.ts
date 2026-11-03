import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../../shared/context/request-context";
import type { IProductPhotoRepository, StoredProductPhoto } from "../../domain/product-photo.repository";
import type { IProductRepository } from "../../domain/product.repository";
import { PhotoUrlSigner } from "../photo-url-signer";
import { RemoveProductPhotoUseCase, ServeProductPhotoUseCase, SetProductPhotoUseCase } from "./product-photo.use-cases";

const signer = new PhotoUrlSigner("secreto-de-prueba-de-al-menos-32-caracteres");
const ownProducts = new Set(["p-1"]);
const productRepo = {
  findByIdOrThrow: async (id: string) => {
    if (!ownProducts.has(id)) throw new Error("Product no encontrado");
    return {};
  },
} as unknown as IProductRepository;

function photoRepo() {
  const store = new Map<string, StoredProductPhoto & { companyId: string }>();
  let clock = 1_700_000_000_000;
  const repo: IProductPhotoRepository = {
    save: async (productId, companyId, mimeType, data) => {
      const updatedAt = new Date((clock += 1000));
      store.set(productId, { companyId, mimeType, data, updatedAt });
      return updatedAt;
    },
    remove: async (productId) => void store.delete(productId),
    findForServing: async (productId) => store.get(productId) ?? null,
    findMany: async (companyId, ids) =>
      new Map([...store].filter(([id, p]) => p.companyId === companyId && ids.includes(id)).map(([id, p]) => [id, p.data])),
  };
  return { repo, store };
}

const asCompany = <T>(fn: () => Promise<T>) =>
  tenantStorage.run({ companyId: "co-1", branchId: null, userId: "u-1", roles: [], permissions: new Set() }, fn);
const jpeg = (bytes: number) => `data:image/jpeg;base64,${Buffer.alloc(bytes, 7).toString("base64")}`;
const parse = (path: string) => {
  const url = new URL(path, "http://x");
  return { id: url.pathname.split("/").pop()!, v: url.searchParams.get("v")!, s: url.searchParams.get("s")! };
};

describe("foto del producto", () => {
  it("se guarda con la empresa del usuario y se sirve solo con su direccion firmada", async () => {
    const { repo, store } = photoRepo();
    const { photoPath } = await asCompany(() => new SetProductPhotoUseCase(productRepo, repo, signer).execute("p-1", jpeg(30_000)));

    expect(store.get("p-1")).toMatchObject({ companyId: "co-1", mimeType: "image/jpeg" });
    const { id, v, s } = parse(photoPath);
    const serve = new ServeProductPhotoUseCase(repo, signer);
    expect((await serve.execute(id, v, s))?.data.length).toBe(30_000);
    // Firma inventada, o la firma de otro producto: no
    expect(await serve.execute(id, v, "x".repeat(22))).toBeNull();
    expect(await serve.execute("p-2", v, s)).toBeNull();
  });

  it("al cambiar la foto, la direccion vieja deja de servir", async () => {
    const { repo } = photoRepo();
    const set = new SetProductPhotoUseCase(productRepo, repo, signer);
    const first = parse((await asCompany(() => set.execute("p-1", jpeg(100)))).photoPath);
    const second = parse((await asCompany(() => set.execute("p-1", jpeg(200)))).photoPath);

    const serve = new ServeProductPhotoUseCase(repo, signer);
    expect(await serve.execute(first.id, first.v, first.s)).toBeNull();
    expect((await serve.execute(second.id, second.v, second.s))?.data.length).toBe(200);
  });

  it("solo imagenes JPG, PNG o WEBP de menos de 300 KB, y solo productos de la empresa", async () => {
    const set = new SetProductPhotoUseCase(productRepo, photoRepo().repo, signer);
    await expect(asCompany(() => set.execute("p-1", "data:application/pdf;base64,AAAA"))).rejects.toThrow(/JPG, PNG o WEBP/);
    await expect(asCompany(() => set.execute("p-1", jpeg(300_001)))).rejects.toThrow(/muy pesada/);
    await expect(asCompany(() => set.execute("p-9", jpeg(100)))).rejects.toThrow(/no encontrado/);
  });

  it("quitar la foto", async () => {
    const { repo, store } = photoRepo();
    await asCompany(() => new SetProductPhotoUseCase(productRepo, repo, signer).execute("p-1", jpeg(100)));
    await asCompany(() => new RemoveProductPhotoUseCase(productRepo, repo).execute("p-1"));
    expect(store.has("p-1")).toBe(false);
  });
});
