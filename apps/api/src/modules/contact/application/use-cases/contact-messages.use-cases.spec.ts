import { describe, expect, it } from "vitest";
import type { ContactMessageRecord, IContactMessageRepository, NewContactMessage } from "../../domain/contact-message.repository";
import { SetContactMessageHandledUseCase, SubmitContactMessageUseCase } from "./contact-messages.use-cases";

function repo() {
  const rows: ContactMessageRecord[] = [];
  const r: IContactMessageRepository = {
    create: async (d: NewContactMessage) => {
      const row = { id: `m-${rows.length + 1}`, ...d, createdAt: new Date(), handledAt: null, handledBy: null };
      rows.push(row);
      return row;
    },
    list: async () => rows,
    setHandled: async (id, by) => {
      const row = rows.find((x) => x.id === id);
      if (!row) return false;
      row.handledAt = by ? new Date() : null;
      row.handledBy = by;
      return true;
    },
  };
  return { r, rows };
}

const msg = (over: Partial<NewContactMessage> = {}): NewContactMessage => ({
  name: "Ana",
  email: "ana@correo.com",
  phone: null,
  company: "Tienda Ana",
  message: "Quiero saber el precio",
  source: "landing",
  ipAddress: "1.2.3.4",
  ...over,
});

describe("formulario de contacto", () => {
  it("guarda el mensaje y le avisa al equipo", async () => {
    const { r, rows } = repo();
    const sent: string[] = [];
    await new SubmitContactMessageUseCase(r, { notifyNewMessage: async (m) => void sent.push(m.name) }).execute(msg());
    expect(rows).toHaveLength(1);
    expect(sent).toEqual(["Ana"]);
  });

  it("si el correo falla, el mensaje igual queda guardado", async () => {
    const { r, rows } = repo();
    const logged: string[] = [];
    const useCase = new SubmitContactMessageUseCase(
      r,
      {
        notifyNewMessage: async () => {
          throw new Error("Resend caido");
        },
      },
      (m) => void logged.push(m)
    );
    await expect(useCase.execute(msg())).resolves.toMatchObject({ name: "Ana" });
    expect(rows).toHaveLength(1);
    expect(logged).toHaveLength(1);
  });

  it("pide al menos un correo o un celular para poder responder", async () => {
    const { r, rows } = repo();
    const useCase = new SubmitContactMessageUseCase(r, { notifyNewMessage: async () => undefined });
    await expect(useCase.execute(msg({ email: null, phone: null }))).rejects.toThrow(/correo o un celular/);
    await expect(useCase.execute(msg({ email: null, phone: "3001234567" }))).resolves.toBeTruthy();
    expect(rows).toHaveLength(1);
  });

  it("marcar y desmarcar como atendido; un mensaje que no existe da error", async () => {
    const { r, rows } = repo();
    await r.create(msg());
    const handled = new SetContactMessageHandledUseCase(r);
    await handled.execute("m-1", true, "admin-1");
    expect(rows[0]).toMatchObject({ handledBy: "admin-1" });
    await handled.execute("m-1", false, "admin-1");
    expect(rows[0]!.handledAt).toBeNull();
    await expect(handled.execute("m-9", true, "admin-1")).rejects.toThrow(/no encontrado/);
  });
});
