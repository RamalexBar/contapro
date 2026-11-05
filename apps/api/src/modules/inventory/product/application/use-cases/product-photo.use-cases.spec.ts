import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../../shared/context/request-context";
import type { IProductPhotoRepository, ProductPhotoRecord } from "../../domain/product-photo.repository";
import type { IProductRepository } from "../../domain/product.repository";
import { PhotoUrlSigner } from "../photo-url-signer";
import {
  AddProductPhotoUseCase,
  ListProductPhotosUseCase,
  RemoveProductPhotoUseCase,
  ServeProductPhotoUseCase,
  SetMainProductPhotoUseCase,
  SetProductPhotoUseCase,
} from "./product-photo.use-cases";

const signer = new PhotoUrlSigner("secreto-de-prueba-de-al-menos-32-caracteres");
const ownProducts = new Set(["p-1", "p-2"]);
const productRepo = {
  findByIdOrThrow: async (id: string) => {
    if (!ownProducts.has(id)) throw new Error("Product no encontrado");
    return {};
  },
} as unknown as IProductRepository;

/** Repo en memoria con la misma regla que el real: position 0 = principal, al quitar se corren las demas. */
function photoRepo() {
  type Row = ProductPhotoRecord & { companyId: string; mimeType: string; data: Buffer };
  const rows: Row[] = [];
  let clock = 1_700_000_000_000;
  let seq = 0;
  const touch = (r: Row) => (r.updatedAt = new Date((clock += 1000)));
  const ofProduct = (productId: string) => rows.filter((r) => r.productId === productId).sort((a, b) => a.position - b.position);
  const reorder = (ids: string[]) =>
    ids.forEach((id, i) => {
      const r = rows.find((x) => x.id === id)!;
      if (r.position !== i) {
        r.position = i;
        touch(r);
      }
    });
  const repo: IProductPhotoRepository = {
    list: async (productId) => ofProduct(productId).map(({ id, productId: pid, position, updatedAt }) => ({ id, productId: pid, position, updatedAt })),
    add: async (productId, companyId, mimeType, data) => {
      const row: Row = { id: `f-${++seq}`, productId, companyId, mimeType, data, position: ofProduct(productId).length, updatedAt: new Date() };
      touch(row);
      rows.push(row);
      return { id: row.id, productId, position: row.position, updatedAt: row.updatedAt };
    },
    remove: async (productId, photoId) => {
      rows.splice(rows.findIndex((r) => r.id === photoId), 1);
      reorder(ofProduct(productId).map((r) => r.id));
    },
    setMain: async (productId, photoId) => {
      const ids = ofProduct(productId).map((r) => r.id);
      reorder([photoId, ...ids.filter((id) => id !== photoId)]);
    },
    findForServing: async (photoId) => {
      const r = rows.find((x) => x.id === photoId);
      return r ? { mimeType: r.mimeType, data: r.data, updatedAt: r.updatedAt } : null;
    },
    findMainPhotos: async (companyId, ids) =>
      new Map(rows.filter((r) => r.companyId === companyId && r.position === 0 && ids.includes(r.productId)).map((r) => [r.productId, r.data])),
  };
  return { repo, rows };
}

const asCompany = <T>(fn: () => Promise<T>) =>
  tenantStorage.run({ companyId: "co-1", branchId: null, userId: "u-1", roles: [], permissions: new Set() }, fn);
const jpeg = (bytes: number) => `data:image/jpeg;base64,${Buffer.alloc(bytes, 7).toString("base64")}`;
const parse = (path: string) => {
  const url = new URL(path, "http://x");
  return { id: url.pathname.split("/").pop()!, v: url.searchParams.get("v")!, s: url.searchParams.get("s")! };
};

describe("fotos del producto", () => {
  it("se guardan con la empresa del usuario y se sirven solo con su direccion firmada", async () => {
    const { repo, rows } = photoRepo();
    const photos = await asCompany(() => new AddProductPhotoUseCase(productRepo, repo, signer).execute("p-1", jpeg(30_000)));

    expect(rows[0]).toMatchObject({ companyId: "co-1", mimeType: "image/jpeg", position: 0 });
    expect(photos).toHaveLength(1);
    expect(photos[0]!.isMain).toBe(true);
    const { id, v, s } = parse(photos[0]!.path);
    const serve = new ServeProductPhotoUseCase(repo, signer);
    expect((await serve.execute(id, v, s))?.data.length).toBe(30_000);
    // Firma inventada, o la firma de otra foto: no
    expect(await serve.execute(id, v, "x".repeat(22))).toBeNull();
    expect(await serve.execute("f-otra", v, s)).toBeNull();
  });

  it("hasta 5 por producto; la primera es la principal", async () => {
    const { repo } = photoRepo();
    const add = new AddProductPhotoUseCase(productRepo, repo, signer);
    for (let i = 0; i < 5; i++) await asCompany(() => add.execute("p-1", jpeg(100 + i)));
    await expect(asCompany(() => add.execute("p-1", jpeg(100)))).rejects.toThrow(/ya tiene 5 fotos/);
    // Otro producto tiene su propio cupo
    await expect(asCompany(() => add.execute("p-2", jpeg(100)))).resolves.toHaveLength(1);

    const list = await asCompany(() => new ListProductPhotosUseCase(productRepo, repo, signer).execute("p-1"));
    expect(list.map((p) => p.isMain)).toEqual([true, false, false, false, false]);
  });

  it("escoger otra como principal y quitar la principal (la siguiente pasa a serlo)", async () => {
    const { repo } = photoRepo();
    const add = new AddProductPhotoUseCase(productRepo, repo, signer);
    await asCompany(() => add.execute("p-1", jpeg(100)));
    await asCompany(() => add.execute("p-1", jpeg(200)));
    const [first, second] = await asCompany(() => add.execute("p-1", jpeg(300)));

    await asCompany(() => new SetMainProductPhotoUseCase(productRepo, repo).execute("p-1", second!.id));
    let list = await repo.list("p-1");
    expect(list.map((p) => p.id)).toEqual([second!.id, first!.id, "f-3"]);

    await asCompany(() => new RemoveProductPhotoUseCase(productRepo, repo).execute("p-1"));
    list = await repo.list("p-1");
    expect(list.map((p) => [p.id, p.position])).toEqual([
      [first!.id, 0],
      ["f-3", 1],
    ]);
    // Una foto de otro producto no se puede poner de principal aqui
    await expect(asCompany(() => new SetMainProductPhotoUseCase(productRepo, repo).execute("p-2", first!.id))).rejects.toThrow(/no es de este producto/);
  });

  it("PUT de la foto (lo de antes) reemplaza la principal y la direccion vieja deja de servir", async () => {
    const { repo } = photoRepo();
    const set = new SetProductPhotoUseCase(productRepo, repo, signer);
    await asCompany(() => new AddProductPhotoUseCase(productRepo, repo, signer).execute("p-1", jpeg(50)));
    const first = parse((await asCompany(() => set.execute("p-1", jpeg(100)))).photoPath);
    const second = parse((await asCompany(() => set.execute("p-1", jpeg(200)))).photoPath);

    const serve = new ServeProductPhotoUseCase(repo, signer);
    expect(await serve.execute(first.id, first.v, first.s)).toBeNull();
    expect((await serve.execute(second.id, second.v, second.s))?.data.length).toBe(200);
    // Reemplazo: siguen siendo 1 principal + nada mas que la nueva
    expect((await repo.list("p-1")).map((p) => p.position)).toEqual([0]);
  });

  it("solo imagenes JPG, PNG o WEBP de menos de 300 KB, y solo productos de la empresa", async () => {
    const add = new AddProductPhotoUseCase(productRepo, photoRepo().repo, signer);
    await expect(asCompany(() => add.execute("p-1", "data:application/pdf;base64,AAAA"))).rejects.toThrow(/JPG, PNG o WEBP/);
    await expect(asCompany(() => add.execute("p-1", jpeg(300_001)))).rejects.toThrow(/muy pesada/);
    await expect(asCompany(() => add.execute("p-9", jpeg(100)))).rejects.toThrow(/no encontrado/);
  });
});
