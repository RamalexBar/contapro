import type { NextFunction, Request, Response } from "express";
import type { GetCompanyProfileUseCase } from "../application/use-cases/get-company-profile.use-case";
import type { UpdateCompanyProfileUseCase } from "../application/use-cases/update-company-profile.use-case";
import { updateCompanyProfileSchema } from "./company.validators";

export class CompanyController {
  constructor(
    private readonly getProfileUseCase: GetCompanyProfileUseCase,
    private readonly updateProfileUseCase: UpdateCompanyProfileUseCase
  ) {}

  getProfile = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.getProfileUseCase.execute());
    } catch (err) {
      next(err);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateCompanyProfileSchema.parse(req.body);
      res.json(await this.updateProfileUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };
}
