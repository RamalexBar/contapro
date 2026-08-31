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
  WOMPI_PRIVATE_KEY: "",
  WOMPI_ENVIRONMENT: "sandbox" as "sandbox" | "production",
}));

vi.mock("../../../config/env", () => ({ env: envMock }));

describe("WompiPaymentGateway", () => {
  beforeEach(() => {
    envMock.WOMPI_PUBLIC_KEY = "";
    envMock.WOMPI_INTEGRITY_SECRET = "";
    envMock.WOMPI_EVENTS_SECRET = "";
    envMock.WOMPI_PRIVATE_KEY = "";
    envMock.WOMPI_ENVIRONMENT = "sandbox";
    vi.unstubAllGlobals();
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

  describe("createPaymentSource / chargePaymentSource", () => {
    function stubFetch(status: number, body: unknown) {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        statusText: "",
        json: async () => body,
      });
      vi.stubGlobal("fetch", fetchMock);
      return fetchMock;
    }

    it("lanza si falta WOMPI_PRIVATE_KEY (createPaymentSource)", async () => {
      const gateway = new WompiPaymentGateway();
      await expect(
        gateway.createPaymentSource({ cardToken: "tok_1", customerEmail: "a@b.com", acceptanceToken: "acc_1" })
      ).rejects.toThrow(/WOMPI_PRIVATE_KEY/);
    });

    it("lanza si falta WOMPI_PRIVATE_KEY (chargePaymentSource)", async () => {
      const gateway = new WompiPaymentGateway();
      await expect(
        gateway.chargePaymentSource({ reference: "r", amountInCents: 100, customerEmail: "a@b.com", paymentSourceId: "ps-1" })
      ).rejects.toThrow(/WOMPI_PRIVATE_KEY/);
    });

    it("lanza si falta WOMPI_INTEGRITY_SECRET (chargePaymentSource)", async () => {
      envMock.WOMPI_PRIVATE_KEY = "prv_test_x";
      const gateway = new WompiPaymentGateway();
      await expect(
        gateway.chargePaymentSource({ reference: "r", amountInCents: 100, customerEmail: "a@b.com", paymentSourceId: "ps-1" })
      ).rejects.toThrow(/WOMPI_INTEGRITY_SECRET/);
    });

    it("createPaymentSource llama a POST /payment_sources con Bearer + body correcto y mapea la respuesta", async () => {
      envMock.WOMPI_PRIVATE_KEY = "prv_test_x";
      const fetchMock = stubFetch(201, { data: { id: 12345, public_data: { last_four: "4242", card_brand: "VISA" } } });

      const gateway = new WompiPaymentGateway();
      const result = await gateway.createPaymentSource({
        cardToken: "tok_test_123",
        customerEmail: "cliente@demo.com",
        acceptanceToken: "acc_token_123",
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://sandbox.wompi.co/v1/payment_sources");
      expect(init.method).toBe("POST");
      expect(init.headers.Authorization).toBe("Bearer prv_test_x");
      expect(JSON.parse(init.body)).toEqual({
        type: "CARD",
        token: "tok_test_123",
        customer_email: "cliente@demo.com",
        acceptance_token: "acc_token_123",
      });
      expect(result).toEqual({ paymentSourceId: "12345", cardLastFour: "4242", cardBrand: "VISA" });
    });

    it("createPaymentSource deriva la marca del `bin` cuando Wompi no manda card_brand (caso real: sandbox nunca lo manda)", async () => {
      envMock.WOMPI_PRIVATE_KEY = "prv_test_x";
      stubFetch(201, { data: { id: 1, public_data: { last_four: "4242", bin: "424242" } } });

      const gateway = new WompiPaymentGateway();
      const result = await gateway.createPaymentSource({ cardToken: "t", customerEmail: "a@b.com", acceptanceToken: "acc" });

      expect(result.cardBrand).toBe("VISA");
    });

    it("createPaymentSource usa la URL de produccion si WOMPI_ENVIRONMENT es production", async () => {
      envMock.WOMPI_PRIVATE_KEY = "prv_test_x";
      envMock.WOMPI_ENVIRONMENT = "production";
      const fetchMock = stubFetch(201, { data: { id: 1 } });

      const gateway = new WompiPaymentGateway();
      await gateway.createPaymentSource({ cardToken: "t", customerEmail: "a@b.com", acceptanceToken: "acc" });

      expect(fetchMock.mock.calls[0][0]).toBe("https://production.wompi.co/v1/payment_sources");
    });

    it("chargePaymentSource llama a POST /transactions con payment_source_id numerico, installments y signature, y mapea el resultado", async () => {
      envMock.WOMPI_PRIVATE_KEY = "prv_test_x";
      envMock.WOMPI_INTEGRITY_SECRET = "integrity_secret_x";
      const fetchMock = stubFetch(201, { data: { id: 999, status: "PENDING" } });

      const gateway = new WompiPaymentGateway();
      const result = await gateway.chargePaymentSource({
        reference: "sub-auto-1",
        amountInCents: 7990000,
        customerEmail: "cliente@demo.com",
        paymentSourceId: "12345",
      });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://sandbox.wompi.co/v1/transactions");
      // Confirmado contra sandbox.wompi.co real: sin payment_method.installments ni signature,
      // Wompi rechaza el request antes de intentar cobrar nada (ver comentario en
      // wompi-payment-gateway.ts) -- este test existe para que nadie los vuelva a quitar.
      const expectedSignature = crypto
        .createHash("sha256")
        .update(`sub-auto-17990000COP${envMock.WOMPI_INTEGRITY_SECRET}`)
        .digest("hex");
      expect(JSON.parse(init.body)).toEqual({
        amount_in_cents: 7990000,
        currency: "COP",
        customer_email: "cliente@demo.com",
        reference: "sub-auto-1",
        payment_source_id: 12345,
        payment_method: { type: "CARD", installments: 1 },
        signature: expectedSignature,
      });
      expect(result).toEqual({ transactionId: "999", status: "PENDING" });
    });

    it("lanza con el `reason` de Wompi cuando la API responde con error", async () => {
      envMock.WOMPI_PRIVATE_KEY = "prv_test_x";
      stubFetch(422, { error: { reason: "TOKEN_INVALID_OR_EXPIRED" } });

      const gateway = new WompiPaymentGateway();
      await expect(
        gateway.createPaymentSource({ cardToken: "bad", customerEmail: "a@b.com", acceptanceToken: "acc" })
      ).rejects.toThrow(/TOKEN_INVALID_OR_EXPIRED/);
    });

    it("lanza un error legible si Wompi responde con un cuerpo no-JSON", async () => {
      envMock.WOMPI_PRIVATE_KEY = "prv_test_x";
      envMock.WOMPI_INTEGRITY_SECRET = "integrity_secret_x";
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => {
          throw new Error("not json");
        },
      });
      vi.stubGlobal("fetch", fetchMock);

      const gateway = new WompiPaymentGateway();
      await expect(
        gateway.chargePaymentSource({ reference: "r", amountInCents: 1, customerEmail: "a@b.com", paymentSourceId: "1" })
      ).rejects.toThrow(/HTTP 500/);
    });
  });
});
