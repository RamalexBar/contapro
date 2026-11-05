import { describe, expect, it } from "vitest";
import { DANE_MUNICIPALITIES, findDaneMunicipality, searchDaneMunicipalities } from "./dane-municipalities";

describe("municipios DANE", () => {
  it("tiene los 1.122 de DIVIPOLA con su departamento", () => {
    expect(DANE_MUNICIPALITIES).toHaveLength(1122);
    expect(findDaneMunicipality("66001")).toEqual({ code: "66001", name: "Pereira", departmentCode: "66", department: "Risaralda" });
    expect(findDaneMunicipality("11001")?.name).toBe("Bogotá, D.C.");
    expect(findDaneMunicipality("05001")?.department).toBe("Antioquia");
    expect(findDaneMunicipality("99999")).toBeNull();
    expect(findDaneMunicipality(null)).toBeNull();
  });

  it("busca sin importar tildes ni mayusculas, primero los que empiezan igual", () => {
    expect(searchDaneMunicipalities("bogota")[0]?.code).toBe("11001");
    expect(searchDaneMunicipalities("PEREIRA")[0]?.code).toBe("66001");
    expect(searchDaneMunicipalities("cucuta").map((m) => m.code)).toContain("54001");
    // "Risaralda" es municipio de Caldas (17616) y tambien departamento: salen ambos, el municipio primero
    const risaralda = searchDaneMunicipalities("risaralda").map((m) => m.code);
    expect(risaralda[0]).toBe("17616");
    expect(risaralda).toContain("66001");
    expect(searchDaneMunicipalities("")).toEqual([]);
  });
});
