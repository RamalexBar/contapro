import type { NextFunction, Request, Response } from "express";
import type { ProvisionPartnerAccountUseCase } from "../application/use-cases/provision-partner-account.use-case";
import { z } from "zod";
import { env } from "../../../config/env";
import { NotFoundError } from "../../../shared/errors/app-error";
import type { CreateLoginLinkUseCase } from "../../auth/application/use-cases/login-links.use-case";
import type { IPartnerAccountRepository } from "../domain/partner-account.repository";
import { provisionPartnerAccountSchema } from "./partner-api.validators";

export class PartnerApiController {
  constructor(
    private readonly provisionUseCase: ProvisionPartnerAccountUseCase,
    private readonly accounts: IPartnerAccountRepository,
    private readonly createLoginLinkUseCase: CreateLoginLinkUseCase
  ) {}

  /** Boton «Entrar a Contapro»: enlace de un solo uso (5 min) para el dueño de la empresa del combo. */
  createCajaproLoginLink = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = z.object({ email: z.string().trim().email() }).parse(req.body);
      const account = await this.accounts.findByExternalId("CAJAPRO", String(req.params.externalId));
      if (!account) throw new NotFoundError("Empresa del combo");
      const link = await this.createLoginLinkUseCase.execute({ companyId: account.companyId, email, source: "CAJAPRO" });
      // El token va en la parte # del enlace: el navegador nunca la manda a un servidor
      res.status(201).json({ url: `${env.CORS_ORIGIN}/entrar#t=${link.token}`, expiresAt: link.expiresAt });
    } catch (err) {
      next(err);
    }
  };

  provisionCajaproAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = provisionPartnerAccountSchema.parse(req.body);
      const result = await this.provisionUseCase.execute({ partner: "CAJAPRO", ...body });
      res.status(result.created ? 201 : 200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
