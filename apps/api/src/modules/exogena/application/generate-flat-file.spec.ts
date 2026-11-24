import { describe, expect, it } from "vitest";
import {
  generateFormat1001FlatFile,
  generateFormat1003FlatFile,
  generateFormat1007FlatFile,
  generateFormat1008FlatFile,
  generateFormat1009FlatFile,
} from "./generate-flat-file";
import type { Format1003Row, Format1008Row, Format1009Row } from "../domain/exogena-report.types";
import type { Format1001Row, Format1007Row } from "./exogena-formats";

describe("generate-flat-file", () => {
  it("formato 1003: concepto de retencion vacio cuando no esta asignado", () => {
    const rows: Format1003Row[] = [
      {
        supplierId: "s1",
        documentType: "NIT",
        documentNumber: "900123456",
        name: "Distribuidora XYZ",
        municipalityCode: "11001",
        incompleto: false,
        conceptoRetencion: null,
        conceptoIncompleto: true,
        valorBase: 50_000,
        valorRetencion: 500,
      },
    ];
    expect(generateFormat1003FlatFile(rows)).toBe("|NIT|900123456|Distribuidora XYZ|169|50000.00|500.00");
  });

  it("formato 1008: solo documento/nombre/saldo", () => {
    const rows: Format1008Row[] = [
      { customerId: "c1", documentType: "CC", documentNumber: "123", name: "Cliente Uno", municipalityCode: null, incompleto: true, saldo: 35_000 },
    ];
    expect(generateFormat1008FlatFile(rows)).toBe("CC|123|Cliente Uno|35000.00");
  });

  it("formato 1009: solo documento/nombre/saldo", () => {
    const rows: Format1009Row[] = [
      { supplierId: "s1", documentType: "NIT", documentNumber: "900123456", name: "Distribuidora XYZ", municipalityCode: null, incompleto: true, saldo: 10_000 },
    ];
    expect(generateFormat1009FlatFile(rows)).toBe("NIT|900123456|Distribuidora XYZ|10000.00");
  });
  it("formato 1001: concepto, tercero, pago deducible sin IVA y las cuatro casillas de IVA y retenciones", () => {
    const rows: Format1001Row[] = [
      {
        supplierId: "s1",
        documentType: "NIT",
        documentNumber: "900123456",
        name: "Distribuidora XYZ",
        municipalityCode: "11001",
        incompleto: false,
        conceptoPago: "5007",
        pagoDeducible: 100_000,
        pagoNoDeducible: 0,
        ivaMayorValorCostoDeducible: 0,
        ivaMayorValorCostoNoDeducible: 0,
        retencionRentaPracticada: 2500,
        retencionRentaAsumida: 0,
        retencionIvaResponsables: 2850,
        retencionIvaNoDomiciliados: 0,
      },
    ];
    expect(generateFormat1001FlatFile(rows)).toBe("5007|NIT|900123456|Distribuidora XYZ|169|11|11001|100000.00|0.00|0.00|0.00|2500.00|0.00|2850.00|0.00");
  });

  it("formato 1007: concepto 4001, ingreso y devoluciones, y consumidor final como cuantias menores", () => {
    const rows: Format1007Row[] = [
      { customerId: null, documentType: "43", documentNumber: "222222222", name: "CUANTIAS MENORES", municipalityCode: null, incompleto: false, conceptoIngreso: "4001", valorIngreso: 80_000, devolucionesRebajasDescuentos: 5_000 },
    ];
    expect(generateFormat1007FlatFile(rows)).toBe("4001|43|222222222|CUANTIAS MENORES|169|||80000.00|5000.00");
  });
});
