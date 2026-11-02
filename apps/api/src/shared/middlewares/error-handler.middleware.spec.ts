import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { operationalAlerts } from "../alerts/operational-alerts";
import { NotFoundError } from "../errors/app-error";
import { errorHandlerMiddleware } from "./error-handler.middleware";

function fakeRes() {
  const res = { statusCode: 0, body: null as unknown, status(code: number) { this.statusCode = code; return this; }, json(b: unknown) { this.body = b; return this; } };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

const req = { method: "POST", baseUrl: "/api", route: { path: "/sales" }, path: "/sales" } as unknown as Request;

describe("errorHandlerMiddleware", () => {
  it("an unexpected error answers 500 and alerts the team, grouped by route and message", () => {
    const send = vi.spyOn(operationalAlerts, "send").mockImplementation(() => undefined);
    const res = fakeRes();

    errorHandlerMiddleware(new Error("connection terminated"), req, res, () => undefined);

    expect(res.statusCode).toBe(500);
    expect(send).toHaveBeenCalledWith("500:POST /api/sales:connection terminated", "Error interno en POST /api/sales", expect.stringContaining("connection terminated"));
    send.mockRestore();
  });

  it("expected errors (4xx) do not alert anyone", () => {
    const send = vi.spyOn(operationalAlerts, "send").mockImplementation(() => undefined);
    const res = fakeRes();

    errorHandlerMiddleware(new NotFoundError("Sale"), req, res, () => undefined);

    expect(res.statusCode).toBe(404);
    expect(send).not.toHaveBeenCalled();
    send.mockRestore();
  });
});
