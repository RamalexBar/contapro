import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { authRateLimiter } from "../../../shared/middlewares/rate-limit.middleware";
import { authController } from "../auth.container";

export const authRouter = Router();

authRouter.post("/auth/register-company", authRateLimiter, authController.registerCompany);
authRouter.post("/auth/login", authRateLimiter, authController.login);
authRouter.post("/auth/refresh", authRateLimiter, authController.refresh);
authRouter.post("/auth/logout", tenantContextMiddleware, authController.logout);
authRouter.post("/auth/forgot-password", authRateLimiter, authController.forgotPassword);
authRouter.post("/auth/reset-password", authRateLimiter, authController.resetPassword);
