import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import type { DeleteCompanyUseCase, SetCompanyArchivedUseCase } from "../application/use-cases/company-admin.use-cases";

/** Panel de plataforma → Empresas: archivar / reactivar / borrar definitivamente. */
export class CompanyAdminController {
  constructor(
    private readonly setArchivedUseCase: SetCompanyArchivedUseCase,
    private readonly deleteUseCase: DeleteCompanyUseCase
  ) {}

  setArchived = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { archived } = z.object({ archived: z.boolean() }).parse(req.body);
      await this.setArchivedUseCase.execute({ companyId: String(req.params.id), archived, platformAdminId: res.locals.platformAdminId });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { confirmName } = z.object({ confirmName: z.string().trim().min(1, "Escriba el nombre de la empresa") }).parse(req.body);
      res.json(await this.deleteUseCase.execute({ companyId: String(req.params.id), confirmName, platformAdminId: res.locals.platformAdminId }));
    } catch (err) {
      next(err);
    }
  };
}
