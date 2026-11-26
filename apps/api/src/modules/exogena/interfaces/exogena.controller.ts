import type { NextFunction, Request, Response } from "express";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error";
import { renderIncomeCertificatePdf, renderWithholdingCertificatePdf } from "../infrastructure/pdfkit-certificate-renderer";
import type { ExogenaReportService } from "../application/exogena-report.service";
import {
  generateFormat1001FlatFile,
  generateFormat1003FlatFile,
  generateFormat1005FlatFile,
  generateFormat1006FlatFile,
  generateFormat2276FlatFile,
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

  /** Lista de proveedores con retenciones en el año (resumen de cada certificado). */
  listWithholdingCertificates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.service.getWithholdingCertificates(parseYear(req)) });
    } catch (err) {
      next(err);
    }
  };

  withholdingCertificatePdf = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const year = parseYear(req);
      const [certificates, issuer] = await Promise.all([this.service.getWithholdingCertificates(year), this.service.getCertificateIssuer()]);
      const cert = certificates.find((c) => c.supplier.id === req.params.supplierId);
      if (!cert) throw new NotFoundError(`El proveedor no tiene retenciones practicadas en ${year}`);
      const pdf = await renderWithholdingCertificatePdf(cert, issuer, new Date());
      res.type("application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="certificado_retenciones_${cert.supplier.documentNumber}_${year}.pdf"`);
      res.send(pdf);
    } catch (err) {
      next(err);
    }
  };

  /** Lista de empleados con pagos en el año (resumen de cada certificado 220). */
  listIncomeCertificates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.service.getIncomeCertificates(parseYear(req)) });
    } catch (err) {
      next(err);
    }
  };

  incomeCertificatePdf = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const year = parseYear(req);
      const [certificates, issuer] = await Promise.all([this.service.getIncomeCertificates(year), this.service.getCertificateIssuer()]);
      const cert = certificates.find((c) => c.employeeId === req.params.employeeId);
      if (!cert) throw new NotFoundError(`El empleado no tiene pagos de nomina en ${year}`);
      const pdf = await renderIncomeCertificatePdf(cert, issuer, new Date());
      res.type("application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="certificado_220_${cert.documentNumber}_${year}.pdf"`);
      res.send(pdf);
    } catch (err) {
      next(err);
    }
  };

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

  getFormat1005 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.service.getFormat1005(parseYear(req)) });
    } catch (err) {
      next(err);
    }
  };

  downloadFormat1005 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const year = parseYear(req);
      sendFlatFile(res, "1005", year, generateFormat1005FlatFile(await this.service.getFormat1005(year)));
    } catch (err) {
      next(err);
    }
  };

  getFormat1006 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.service.getFormat1006(parseYear(req)) });
    } catch (err) {
      next(err);
    }
  };

  downloadFormat1006 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const year = parseYear(req);
      sendFlatFile(res, "1006", year, generateFormat1006FlatFile(await this.service.getFormat1006(year)));
    } catch (err) {
      next(err);
    }
  };

  getFormat2276 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.service.getFormat2276(parseYear(req)) });
    } catch (err) {
      next(err);
    }
  };

  downloadFormat2276 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const year = parseYear(req);
      sendFlatFile(res, "2276", year, generateFormat2276FlatFile(await this.service.getFormat2276(year)));
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
