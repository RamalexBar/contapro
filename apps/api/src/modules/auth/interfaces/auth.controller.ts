import type { NextFunction, Request, Response } from "express";
import type { LoginUseCase } from "../application/use-cases/login.use-case";
import type { RegisterCompanyUseCase } from "../application/use-cases/register-company.use-case";
import type { RefreshTokenUseCase } from "../application/use-cases/refresh-token.use-case";
import type { LogoutUseCase } from "../application/use-cases/logout.use-case";
import type { RequestPasswordResetUseCase } from "../application/use-cases/request-password-reset.use-case";
import type { ResetPasswordUseCase } from "../application/use-cases/reset-password.use-case";
import { forgotPasswordSchema, loginSchema, refreshTokenSchema, registerCompanySchema, resetPasswordSchema } from "./auth.validators";

export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly registerCompanyUseCase: RegisterCompanyUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase
  ) {}

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = loginSchema.parse(req.body);
      const result = await this.loginUseCase.execute({
        email: body.email,
        password: body.password,
        companyId: body.companyId,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  registerCompany = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = registerCompanySchema.parse(req.body);
      const result = await this.registerCompanyUseCase.execute(body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = refreshTokenSchema.parse(req.body);
      const result = await this.refreshTokenUseCase.execute(body.refreshToken);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = refreshTokenSchema.parse(req.body);
      await this.logoutUseCase.execute(body.refreshToken);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = forgotPasswordSchema.parse(req.body);
      await this.requestPasswordResetUseCase.execute(body.email);
      // Mismo mensaje exista o no el correo -- evita revelar que correos estan registrados.
      res.json({ message: "Si el correo existe, te enviamos un enlace para restablecer tu contraseña." });
    } catch (err) {
      next(err);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = resetPasswordSchema.parse(req.body);
      await this.resetPasswordUseCase.execute(body.token, body.newPassword);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
