import type { NextFunction, Request, Response } from "express";
import { ValidationError } from "../../../shared/errors/app-error";
import type { ExogenaReportService } from "../application/exogena-report.service";
import {
  generateFormat1001FlatFile,
  generateFormat1003FlatFile,
  generateFormat1007FlatFile,
  generateFormat1008FlatFile,
  generateFormat1009FlatFile,
} from "../application/generate-flat-file";

function parseYear(req: Request): number {
  const raw = typeof req.query.year === "string" ? Number(req.query.year) : new Date().getFullYear();
  if (!Number.isInteger(raw) || raw < 2000 || raw > 2100) {
    throw new ValidationError("El parametro year debe ser un año valido (ej. ?year=2026)");
  }
  return raw;
}

function sendFlatFile(res: Response, formatCode: string, year: number | null, content: string): void {
  const suffix = year ? `_${year}` : "";
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="formato_${formatCode}${suffix}.txt"`);
  res.send(content);
}

export class ExogenaController {
  constructor(private readonly service: ExogenaReportService) {}

  getFormat1001 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.service.getFormat1001(parseYear(req)) });
    } catch (err) {
      next(err);
    }
  };

  downloadFormat1001 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const year = parseYear(req);
      const rows = await this.service.getFormat1001(year);
      sendFlatFile(res, "1001", year, generateFormat1001FlatFile(rows));
    } catch (err) {
      next(err);
    }
  };

  getFormat1003 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.service.getFormat1003(parseYear(req)) });
    } catch (err) {
      next(err);
    }
  };

  downloadFormat1003 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const year = parseYear(req);
      const rows = await this.service.getFormat1003(year);
      sendFlatFile(res, "1003", year, generateFormat1003FlatFile(rows));
    } catch (err) {
      next(err);
    }
  };

  getFormat1007 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.service.getFormat1007(parseYear(req)) });
    } catch (err) {
      next(err);
    }
  };

  downloadFormat1007 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const year = parseYear(req);
      const rows = await this.service.getFormat1007(year);
      sendFlatFile(res, "1007", year, generateFormat1007FlatFile(rows));
    } catch (err) {
      next(err);
    }
  };

  // 1008/1009 (saldos) no reciben year: reportan el saldo ACTUAL de cuentas activas, no un
  // snapshot historico (el sistema no versiona el saldo en el tiempo, ver README del modulo).
  getFormat1008 = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.service.getFormat1008() });
    } catch (err) {
      next(err);
    }
  };

  downloadFormat1008 = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await this.service.getFormat1008();
      sendFlatFile(res, "1008", null, generateFormat1008FlatFile(rows));
    } catch (err) {
      next(err);
    }
  };

  getFormat1009 = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.service.getFormat1009() });
    } catch (err) {
      next(err);
    }
  };

  downloadFormat1009 = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await this.service.getFormat1009();
      sendFlatFile(res, "1009", null, generateFormat1009FlatFile(rows));
    } catch (err) {
      next(err);
    }
  };
}
