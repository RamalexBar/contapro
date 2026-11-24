import { describe, expect, it } from "vitest";
import { resolvePurchaseWithholding } from "./resolve-purchase-withholding";

const UVT_2026 = 52_374;
const SERVICES = { code: "RF-SERVICIOS", type: "RETEFUENTE" as const, ratePercent: 4, minBaseUvt: 2, nonDeclarantRatePercent: 6 };
const PURCHASES = { code: "RF-COMPRAS", type: "RETEFUENTE" as const, ratePercent: 2.5, minBaseUvt: 10, nonDeclarantRatePercent: 3.5 };
const RETEIVA = { code: "IVA-RETE", type: "RETEIVA" as const, ratePercent: 15, minBaseUvt: 10, nonDeclarantRatePercent: null };

describe("resolvePurchaseWithholding (Decreto 572 de 2025)", () => {
  it("skips a purchase below 10 UVT and explains why", () => {
    const d = resolvePurchaseWithholding({ concept: PURCHASES, base: 500_000, purchaseSubtotal: 500_000, supplierDeclarant: true, uvt: UVT_2026 });
    expect(d.applies).toBe(false);
    expect(d.reason).toContain("10 UVT");
    expect(d.reason).toContain("523.740");
  });

  it("applies from exactly the minimum base", () => {
    const d = resolvePurchaseWithholding({ concept: PURCHASES, base: 523_740, purchaseSubtotal: 523_740, supplierDeclarant: true, uvt: UVT_2026 });
    expect(d).toEqual({ applies: true, ratePercent: 2.5 });
  });

  it("uses the non-declarant rate (services 6% instead of 4%)", () => {
    const d = resolvePurchaseWithholding({ concept: SERVICES, base: 300_000, purchaseSubtotal: 300_000, supplierDeclarant: false, uvt: UVT_2026 });
    expect(d).toEqual({ applies: true, ratePercent: 6 });
  });

  it("measures the ReteIVA minimum on the purchase value, not on the IVA", () => {
    const d = resolvePurchaseWithholding({ concept: RETEIVA, base: 114_000, purchaseSubtotal: 600_000, supplierDeclarant: false, uvt: UVT_2026 });
    expect(d).toEqual({ applies: true, ratePercent: 15 }); // el IVA (114.000) esta bajo 10 UVT, la compra no
  });

  it("applies without checking the minimum when the year's UVT is missing", () => {
    expect(resolvePurchaseWithholding({ concept: PURCHASES, base: 1_000, purchaseSubtotal: 1_000, supplierDeclarant: true, uvt: null }).applies).toBe(true);
  });
});
