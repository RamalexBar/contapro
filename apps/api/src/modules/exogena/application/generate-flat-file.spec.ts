import { describe, expect, it } from "vitest";
import {
  generateFormat1001FlatFile,
  generateFormat1003FlatFile,
  generateFormat1007FlatFile,
  generateFormat1008FlatFile,
  generateFormat1009FlatFile,
} from "./generate-flat-file";
import type { Format1001Row, Format1003Row, Format1007Row, Format1008Row, Format1009Row } from "../domain/exogena-report.types";

describe("generate-flat-file", () => {
  it("formato 1001: una linea por fila, columnas separadas por |, montos con 2 decimales, departamento derivado del municipio", () => {
    const rows: Format1001Row[] = [
      {
        supplierId: "s1",
        documentType: "NIT",
        documentNumber: "900123456",
        name: "Distribuidora XYZ",
        municipalityCode: "11001",
        incompleto: false,
        conceptoPago: "5002",
        valorPago: 100_000,
        valorRetencionPracticada: 2500,
      },
    ];
    const content = generateFormat1001FlatFile(rows);
    expect(content).toBe("5002|NIT|900123456|Distribuidora XYZ|169|11|11001|100000.00|2500.00");
  });

  it("formato 1001: municipio vacio deja departamento y municipio en blanco", () => {
    const rows: Format1001Row[] = [
      {
        supplierId: "s2",
        documentType: "NIT",
        documentNumber: "900999999",
        name: "Proveedor Incompleto",
        municipalityCode: null,
        incompleto: true,
        conceptoPago: "5002",
        valorPago: 50_000,
        valorRetencionPracticada: 500,
      },
    ];
    const content = generateFormat1001FlatFile(rows);
    expect(content).toBe("5002|NIT|900999999|Proveedor Incompleto|169|||50000.00|500.00");
  });

  it("formato 1001: multiples filas van en lineas separadas por salto de linea", () => {
    const row: Format1001Row = {
      supplierId: "s1",
      documentType: "NIT",
      documentNumber: "900123456",
      name: "A",
      municipalityCode: "11001",
      incompleto: false,
      conceptoPago: "5002",
      valorPago: 1,
      valorRetencionPracticada: 0,
    };
    const content = generateFormat1001FlatFile([row, { ...row, supplierId: "s2", documentNumber: "900999999" }]);
    expect(content.split("\n")).toHaveLength(2);
  });

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

  it("formato 1007: incluye departamento/municipio e ingreso", () => {
    const rows: Format1007Row[] = [
      {
        customerId: "c1",
        documentType: "CC",
        documentNumber: "123",
        name: "Cliente Uno",
        municipalityCode: "05001",
        incompleto: false,
        valorIngreso: 80_000,
      },
    ];
    expect(generateFormat1007FlatFile(rows)).toBe("CC|123|Cliente Uno|169|05|05001|80000.00");
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
});
