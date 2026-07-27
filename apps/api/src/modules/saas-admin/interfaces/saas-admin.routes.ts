import { Router } from "express";
import { notImplemented } from "../../../shared/middlewares/not-implemented.middleware";

// NOTA: este router NO usa tenantContextMiddleware -- el panel de administrador SaaS es
// transversal a todas las empresas y requerira su propio mecanismo de autenticacion de
// "super-admin de plataforma" (distinto del JWT por empresa). Queda documentado para cuando
// se implemente el modulo.
export const saasAdminRouter = Router();

const stub = notImplemented("saas-admin");
saasAdminRouter.all("/admin/companies", stub);
saasAdminRouter.all("/admin/plans", stub);
saasAdminRouter.all("/admin/subscriptions", stub);
saasAdminRouter.all("/admin/payments", stub);
