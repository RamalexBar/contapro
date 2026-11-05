import { describe, expect, it } from "vitest";
import type { AuditService } from "../../../audit/application/audit.service";
import { CompanyDeleteError, type CompanyAdminRecord, type ICompanyAdminRepository } from "../../domain/company-admin.repository";
import { DeleteCompanyUseCase, SetCompanyArchivedUseCase } from "./company-admin.use-cases";

function setup(company: CompanyAdminRecord | null, opts: { failDelete?: boolean; fileKeys?: string[] } = {}) {
  const state = { company, deleted: [] as string[], audits: [] as string[], alerts: [] as string[], filesDeleted: [] as string[] };
  const repo: ICompanyAdminRepository = {
    findById: async (id) => (state.company?.id === id ? state.company : null),
    setActive: async (_id, isActive) => {
      state.company = { ...state.company!, isActive };
    },
    deleteCompletely: async (id) => {
      if (opts.failDelete) throw new CompanyDeleteError("No se borro nada: 1 registro(s) de «sales» pertenecen a otra empresa");
      state.deleted.push(id);
      return { deleted: 42 };
    },
    listStoredFileKeys: async () => opts.fileKeys ?? [],
  };
  const storage = {
    put: async () => undefined,
    get: async () => null,
    delete: async (key: string) => {
      if (key.includes("rota")) throw new Error("R2 caido");
      state.filesDeleted.push(key);
    },
  };
  const audit = { recordWithoutContext: async (_c: string, _u: null, e: { action: string }) => void state.audits.push(e.action) } as unknown as AuditService;
  const alerts = { send: (_k: string, subject: string, detail: string) => void state.alerts.push(`${subject} | ${detail}`) };
  return { state, archive: new SetCompanyArchivedUseCase(repo, audit), del: new DeleteCompanyUseCase(repo, alerts, opts.fileKeys ? storage : null) };
}

const demo: CompanyAdminRecord = { id: "co-1", name: "Demo SAS", isActive: true, partner: null };

describe("archivar y borrar empresas", () => {
  it("archivar y reactivar cambian solo si hace falta, y quedan en la auditoria de la empresa", async () => {
    const { state, archive } = setup(demo);
    await archive.execute({ companyId: "co-1", archived: true, platformAdminId: "adm" });
    await archive.execute({ companyId: "co-1", archived: true, platformAdminId: "adm" });
    expect(state.company!.isActive).toBe(false);
    await archive.execute({ companyId: "co-1", archived: false, platformAdminId: "adm" });
    expect(state.company!.isActive).toBe(true);
    expect(state.audits).toEqual(["COMPANY_ARCHIVED", "COMPANY_REACTIVATED"]);
  });

  it("no deja borrar una empresa sin archivarla primero", async () => {
    const { state, del } = setup(demo);
    await expect(del.execute({ companyId: "co-1", confirmName: "Demo SAS", platformAdminId: "adm" })).rejects.toThrow(/Primero archive/);
    expect(state.deleted).toEqual([]);
  });

  it("pide el nombre exacto", async () => {
    const { state, del } = setup({ ...demo, isActive: false });
    await expect(del.execute({ companyId: "co-1", confirmName: "Demo", platformAdminId: "adm" })).rejects.toThrow(/no coincide/);
    expect(state.deleted).toEqual([]);
  });

  it("borra la archivada y deja el registro en el correo del equipo (avisa si venia del combo)", async () => {
    const { state, del } = setup({ ...demo, isActive: false, partner: "CAJAPRO" });
    expect(await del.execute({ companyId: "co-1", confirmName: " Demo SAS ", platformAdminId: "adm-7" })).toEqual({ deleted: 42 });
    expect(state.deleted).toEqual(["co-1"]);
    expect(state.alerts[0]).toContain("Empresa borrada: Demo SAS");
    expect(state.alerts[0]).toContain("adm-7");
    expect(state.alerts[0]).toContain("combo de CAJAPRO");
  });

  it("borra tambien sus fotos en R2 y avisa las que no pudo", async () => {
    const { state, del } = setup({ ...demo, isActive: false }, { fileKeys: ["companies/co-1/a.jpg", "companies/co-1/rota.jpg"] });
    await del.execute({ companyId: "co-1", confirmName: "Demo SAS", platformAdminId: "adm" });
    expect(state.filesDeleted).toEqual(["companies/co-1/a.jpg"]);
    expect(state.alerts[0]).toContain("Fotos en R2: 1 borradas, 1 no se pudieron borrar");
  });

  it("si el seguro encuentra datos de otra empresa, no borra y lo explica", async () => {
    const { del } = setup({ ...demo, isActive: false }, { failDelete: true });
    await expect(del.execute({ companyId: "co-1", confirmName: "Demo SAS", platformAdminId: "adm" })).rejects.toThrow(/otra empresa/);
  });
});
