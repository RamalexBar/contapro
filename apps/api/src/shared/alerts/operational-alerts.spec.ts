import { describe, expect, it, vi } from "vitest";
import { OperationalAlerts } from "./operational-alerts";

function make() {
  const sent: string[] = [];
  const clock = { now: 0 };
  const alerts = new OperationalAlerts(async (subject) => {
    sent.push(subject);
  }, () => clock.now);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  return { alerts, sent, clock };
}

describe("OperationalAlerts", () => {
  it("sends the same problem once every 6 hours, and different problems separately", () => {
    const { alerts, sent, clock } = make();
    alerts.send("dian", "Envio DIAN fallo", "x");
    alerts.send("dian", "Envio DIAN fallo", "x");
    alerts.send("cobro", "Cobro fallo", "y");
    expect(sent).toEqual(["Envio DIAN fallo", "Cobro fallo"]);

    clock.now = 6 * 60 * 60 * 1000 - 1;
    alerts.send("dian", "Envio DIAN fallo", "x");
    expect(sent).toHaveLength(2);

    clock.now = 6 * 60 * 60 * 1000;
    alerts.send("dian", "Envio DIAN fallo", "x");
    expect(sent).toHaveLength(3);
  });

  it("never sends more than 20 emails in an hour, even if many different things fail at once", () => {
    const { alerts, sent, clock } = make();
    for (let i = 0; i < 30; i++) alerts.send(`k${i}`, `fallo ${i}`, "");
    expect(sent).toHaveLength(20);

    clock.now = 60 * 60 * 1000;
    alerts.send("k25", "fallo 25", "");
    expect(sent).toHaveLength(21);
  });

  it("a failing email never breaks the caller", async () => {
    const alerts = new OperationalAlerts(async () => {
      throw new Error("Resend caido");
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => alerts.send("k", "s", "d")).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});
