import type { NextFunction, Request, Response } from "express";
import type { LoginUseCase } from "../application/use-cases/login.use-case";
import type { RegisterCompanyUseCase } from "../application/use-cases/register-company.use-case";
import type { RefreshTokenUseCase } from "../application/use-cases/refresh-token.use-case";
import type { LogoutUseCase } from "../application/use-cases/logout.use-case";
import { loginSchema, refreshTokenSchema, registerCompanySchema } from "./auth.validators";

export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly registerCompanyUseCase: RegisterCompanyUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase
  ) {}

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = loginSchema.parse(req.body);
      const result = await this.loginUseCase.execute({
        email: body.email,
        password: body.password,
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
}
