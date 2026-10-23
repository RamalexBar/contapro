import type { NextFunction, Request, Response } from "express";
import type { ProvisionPartnerAccountUseCase } from "../application/use-cases/provision-partner-account.use-case";
import { provisionPartnerAccountSchema } from "./partner-api.validators";

export class PartnerApiController {
  constructor(private readonly provisionUseCase: ProvisionPartnerAccountUseCase) {}

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
