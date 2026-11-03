import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Direccion firmada de la foto de un producto: `/product-photos/:id?v=<version>&s=<firma>`. Un <img> no puede mandar el
 * token de sesion, asi que la foto se sirve sin sesion, pero solo con la firma correcta para ESE producto y ESA
 * version (nadie puede armar la direccion de otra foto). Como la version cambia cuando cambia la foto, el navegador
 * puede guardarla en cache para siempre.
 */
export class PhotoUrlSigner {
  constructor(private readonly secret: string) {}

  private sign(productId: string, version: string) {
    return createHmac("sha256", this.secret).update(`product-photo:${productId}:${version}`).digest("base64url").slice(0, 22);
  }

  path(productId: string, updatedAt: Date): string {
    const v = String(updatedAt.getTime());
    return `/product-photos/${productId}?v=${v}&s=${this.sign(productId, v)}`;
  }

  verify(productId: string, version: string, signature: string): boolean {
    const expected = Buffer.from(this.sign(productId, version));
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}
