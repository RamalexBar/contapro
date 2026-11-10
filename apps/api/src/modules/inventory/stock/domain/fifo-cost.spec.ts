import { describe, expect, it } from "vitest";
import { allocateFifo, layerQuantityForEntry, segmentsCost, valueStock } from "./fifo-cost";

describe("allocateFifo", () => {
  const enero = { id: "enero", quantity: 10, unitCost: 250 };
  const marzo = { id: "marzo", quantity: 10, unitCost: 300 };

  it("vende primero lo de enero a $250 mientras quede", () => {
    const segments = allocateFifo([enero, marzo], 4, 300);
    expect(segments).toEqual([{ layerId: "enero", quantity: 4, unitCost: 250 }]);
    expect(segmentsCost(segments)).toBe(1000);
  });

  it("al agotar enero sigue con marzo en la misma venta", () => {
    const segments = allocateFifo([{ ...enero, quantity: 3 }, marzo], 5, 300);
    expect(segments).toEqual([
      { layerId: "enero", quantity: 3, unitCost: 250 },
      { layerId: "marzo", quantity: 2, unitCost: 300 },
    ]);
    expect(segmentsCost(segments)).toBe(1350);
  });

  it("lo que no alcanza a cubrir ninguna capa sale al costo vigente", () => {
    const segments = allocateFifo([{ ...enero, quantity: 2 }], 5, 280);
    expect(segments).toEqual([
      { layerId: "enero", quantity: 2, unitCost: 250 },
      { layerId: null, quantity: 3, unitCost: 280 },
    ]);
  });

  it("salta capas vacias y respeta decimales", () => {
    const segments = allocateFifo([{ id: "vacia", quantity: 0, unitCost: 1 }, { id: "kg", quantity: 1.5, unitCost: 1000 }], 0.25, 0);
    expect(segments).toEqual([{ layerId: "kg", quantity: 0.25, unitCost: 1000 }]);
  });
});

describe("layerQuantityForEntry", () => {
  it("toda la entrada queda como capa cuando no habia faltante", () => {
    expect(layerQuantityForEntry(10, 15, 5)).toBe(10);
  });

  it("si se habia vendido en negativo, la entrada primero tapa el hueco", () => {
    // Existencias -2 (sin capas), entran 10 -> quedan 8 reales: solo 8 deben quedar como capa.
    expect(layerQuantityForEntry(10, 8, 0)).toBe(8);
  });

  it("no crea capa si la entrada no alcanza a sacar la sucursal del negativo", () => {
    expect(layerQuantityForEntry(3, -1, 0)).toBe(0);
  });
});

describe("valueStock", () => {
  it("valoriza cada capa a su costo real", () => {
    expect(valueStock([{ id: "a", quantity: 3, unitCost: 250 }, { id: "b", quantity: 10, unitCost: 300 }], 13, 999)).toBe(3750);
  });

  it("lo que no tiene capa se valoriza al costo vigente", () => {
    expect(valueStock([{ id: "a", quantity: 2, unitCost: 250 }], 5, 300)).toBe(1400);
  });
});
