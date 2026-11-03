import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import type { RemoveProductPhotoUseCase, ServeProductPhotoUseCase, SetProductPhotoUseCase } from "../application/use-cases/product-photo.use-cases";

export class ProductPhotoController {
  constructor(
    private readonly setUseCase: SetProductPhotoUseCase,
    private readonly removeUseCase: RemoveProductPhotoUseCase,
    private readonly serveUseCase: ServeProductPhotoUseCase
  ) {}

  set = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { dataUrl } = z.object({ dataUrl: z.string().max(450_000, "La foto es muy pesada") }).parse(req.body);
      res.json(await this.setUseCase.execute(String(req.params.id), dataUrl));
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.removeUseCase.execute(String(req.params.id));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  /** Publica (un <img> no manda la sesion): la protege la firma. Se puede guardar en cache para siempre: si la foto
   * cambia, cambia la direccion. La web esta en otro dominio que la API, por eso Cross-Origin-Resource-Policy. */
  serve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const photo = await this.serveUseCase.execute(String(req.params.id), String(req.query.v ?? ""), String(req.query.s ?? ""));
      if (!photo) {
        res.status(404).end();
        return;
      }
      res.set({
        "Content-Type": photo.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Cross-Origin-Resource-Policy": "cross-origin",
      });
      res.send(photo.data);
    } catch (err) {
      next(err);
    }
  };
}
