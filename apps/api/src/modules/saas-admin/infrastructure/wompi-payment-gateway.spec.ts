import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WompiWebhookEvent } from "../domain/payment-gateway";
import { WompiPaymentGateway } from "./wompi-payment-gateway";

// vi.hoisted (no un const normal): vi.mock se hoistea al tope absoluto del archivo, por encima de
// cualquier declaracion -- una variable normal referenciada dentro del factory de vi.mock cae en
// su temporal dead zone. vi.hoisted ejecuta este callback en ese mismo momento del hoisting.
const envMock = vi.hoisted(() => ({
  WOMPI_PUBLIC_KEY: "",
  WOMPI_INTEGRITY_SECRET: "",
  WOMPI_EVENTS_SECRET: "",
}));

vi.mock("../../../config/env", () => ({ env: envMock }));

describe("WompiPaymentGateway", () => {
  beforeEach(() => {
    envMock.WOMPI_PUBLIC_KEY = "";
    envMock.WOMPI_INTEGRITY_SECRET = "";
    envMock.WOMPI_EVENTS_SECRET = "";
  });

  describe("buildCheckoutUrl", () => {
    it("lanza si faltan las llaves", () => {
      const gateway = new WompiPaymentGateway();
      expect(() =>
        gateway.buildCheckoutUrl({ reference: "ref-1", amountInCents: 100, customerEmail: "a@b.com" })
      ).toThrow(/WOMPI_PUBLIC_KEY/);
    });

    it("calcula la firma de integridad EXACTAMENTE como el ejemplo oficial de docs.wompi.co", () => {
      // Ejemplo publicado en docs.wompi.co/en/docs/colombia/widget-checkout-web: concatenando
      // reference + amountInCents + "COP" + integritySecret (sin separador) y aplicando SHA256
      // se obtiene el string de entrada "sk8-438k4-xmxm392-sn2m2490000COPprod_integrity_..." con
      // hash esperado 37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5 -- se
      // verifico manualmente con node antes de escribir la implementacion (ver comentario en
      // wompi-payment-gateway.ts).
      envMock.WOMPI_PUBLIC_KEY = "pub_test_x";
      envMock.WOMPI_INTEGRITY_SECRET = "prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6";

      const gateway = new WompiPaymentGateway();
      const { checkoutUrl } = gateway.buildCheckoutUrl({
        reference: "sk8-438k4-xmxm392-sn2m2",
        amountInCents: 490000,
        customerEmail: "cliente@demo.com",
      });

      const url = new URL(checkoutUrl);
      expect(url.searchParams.get("signature:integrity")).toBe(
        "37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5"
      );
      expect(url.searchParams.get("public-key")).toBe("pub_test_x");
      expect(url.searchParams.get("amount-in-cents")).toBe("490000");
      expect(url.searchParams.get("currency")).toBe("COP");
    });

    it("incluye redirect-url solo si se pasa", () => {
      envMock.WOMPI_PUBLIC_KEY = "pub_test_x";
      envMock.WOMPI_INTEGRITY_SECRET = "secret";
      const gateway = new WompiPaymentGateway();

      const withoutRedirect = gateway.buildCheckoutUrl({ reference: "r", amountInCents: 1, customerEmail: "a@b.com" });
      expect(new URL(withoutRedirect.checkoutUrl).searchParams.has("redirect-url")).toBe(false);

      const withRedirect = gateway.buildCheckoutUrl({
        reference: "r",
        amountInCents: 1,
        customerEmail: "a@b.com",
        redirectUrl: "https://app.contapro.demo/gracias",
      });
      expect(new URL(withRedirect.checkoutUrl).searchParams.get("redirect-url")).toBe("https://app.contapro.demo/gracias");
    });
  });

  describe("verifyWebhookSignature", () => {
    function makeEvent(overrides: Partial<WompiWebhookEvent> = {}): WompiWebhookEvent {
      return {
        event: "transaction.updated",
        data: { transaction: { id: "tx-1", status: "APPROVED", reference: "sub-abc-123", amount_in_cents: 79900 } },
        environment: "test",
        timestamp: 1530291411,
        signature: { properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"], checksum: "" },
        ...overrides,
      };
    }

    it("devuelve false si no hay WOMPI_EVENTS_SECRET configurado", () => {
      const gateway = new WompiPaymentGateway();
      expect(gateway.verifyWebhookSignature(makeEvent({ signature: { properties: ["transaction.id"], checksum: "abc" } }))).toBe(
        false
      );
    });

    it("acepta un checksum calculado con el mismo algoritmo documentado (properties en orden + timestamp + secreto, SHA256)", () => {
      envMock.WOMPI_EVENTS_SECRET = "test_events_secret";
      const event = makeEvent();
      const raw = `${event.data.transaction.id}${event.data.transaction.status}${event.data.transaction.amount_in_cents}${event.timestamp}${envMock.WOMPI_EVENTS_SECRET}`;
      event.signature.checksum = crypto.createHash("sha256").update(raw).digest("hex");

      const gateway = new WompiPaymentGateway();
      expect(gateway.verifyWebhookSignature(event)).toBe(true);
    });

    it("rechaza un checksum que no coincide", () => {
      envMock.WOMPI_EVENTS_SECRET = "test_events_secret";
      const event = makeEvent({ signature: { properties: ["transaction.id"], checksum: "0".repeat(64) } });

      const gateway = new WompiPaymentGateway();
      expect(gateway.verifyWebhookSignature(event)).toBe(false);
    });

    it("respeta el orden de `properties` del evento (no asume un orden fijo)", () => {
      envMock.WOMPI_EVENTS_SECRET = "test_events_secret";
      const event = makeEvent({ signature: { properties: ["transaction.status", "transaction.id"], checksum: "" } });
      // Checksum calculado con el orden INVERSO al que declara properties -- debe fallar, porque
      // verifyWebhookSignature tiene que seguir el orden que trae el evento, no uno fijo.
      const wrongOrderRaw = `${event.data.transaction.id}${event.data.transaction.status}${event.timestamp}${envMock.WOMPI_EVENTS_SECRET}`;
      event.signature.checksum = crypto.createHash("sha256").update(wrongOrderRaw).digest("hex");

      const gateway = new WompiPaymentGateway();
      expect(gateway.verifyWebhookSignature(event)).toBe(false);
    });
  });
});
