import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import type {
  ListContactMessagesUseCase,
  SetContactMessageHandledUseCase,
  SubmitContactMessageUseCase,
} from "../application/use-cases/contact-messages.use-cases";

const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

const submitSchema = z.object({
  name: z.string().trim().min(2, "Escriba su nombre").max(120),
  email: z.union([z.literal(""), z.string().trim().email("Correo no valido").max(160)]).optional().transform((v) => v || null),
  phone: optional(30),
  company: optional(120),
  message: z.string().trim().min(5, "Escriba su mensaje").max(2000),
  source: z.string().trim().max(40).optional(),
  // Trampa para robots: las personas no ven este campo
  website: z.string().max(200).optional(),
});

export class ContactController {
  constructor(
    private readonly submitUseCase: SubmitContactMessageUseCase,
    private readonly listUseCase: ListContactMessagesUseCase,
    private readonly setHandledUseCase: SetContactMessageHandledUseCase
  ) {}

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { website, source, ...body } = submitSchema.parse(req.body);
      // Un robot llena el campo oculto: se le responde igual que a una persona, pero no se guarda nada
      if (website) {
        res.status(201).json({ ok: true });
        return;
      }
      await this.submitUseCase.execute({ ...body, source: source || "landing", ipAddress: req.ip ?? null });
      res.status(201).json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  list = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listUseCase.execute() });
    } catch (err) {
      next(err);
    }
  };

  setHandled = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { handled } = z.object({ handled: z.boolean() }).parse(req.body);
      await this.setHandledUseCase.execute(String(req.params.id), handled, res.locals.platformAdminId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
