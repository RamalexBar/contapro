import type { FactusOAuthCredentials } from "../infrastructure/factus-auth";

export interface FactusNumberingRangeInput {
  /** Prefijo alfanumerico, maximo 4 caracteres (mismo campo que InvoiceNumberingResolution.prefix). */
  prefix: string;
  /** Numero de resolucion DIAN (InvoiceNumberingResolution.resolutionNumber). */
  resolutionNumber: string;
  /** Consecutivo del proximo documento a generar -- InvoiceNumberingResolution.rangeFrom para un
   * rango que todavia no se uso en Factus. */
  current: number;
}

/**
 * Aprovisionamiento automatico de la cuenta de Factus de una empresa, al activarla como proveedor
 * (ver set-electronic-invoicing-provider.use-case.ts). Implementado por
 * infrastructure/factus-account-provisioning.service.ts -- **sin verificar contra un servicio
 * real**: `POST /v2/numbering-ranges` y `POST /v2/companies/logo` devuelven
 * `500 Internal Server Error` en el sandbox compartido de Factus sin importar el contenido del
 * request (probado con el payload documentado exacto y con una imagen minima valida), lo que
 * apunta a que esas dos operaciones estan bloqueadas para cuentas compartidas -- no se pudo
 * confirmar con una cuenta de Factus dedicada. Implementado siguiendo al pie de la letra la
 * documentacion oficial (developers.factus.com.co/rangos-de-numeracion/facturación/crear-rango/
 * y /empresas/actualizar-imagen/), mismo criterio que dian-soap-client.ts (integraciones
 * documentadas pero no verificadas en vivo).
 */
export interface IFactusAccountProvisioner {
  /** Crea en Factus el rango de numeracion de facturas de venta a partir de la resolucion DIAN
   * que Contapro ya tiene registrada, y devuelve el `numbering_range_id` que Factus asigna --
   * ese id es el que despues usa factus-invoicing-client.ts en cada factura. Lanza si Factus
   * rechaza la creacion (bloqueante: sin un rango, Factus no puede facturar nada). */
  createSalesNumberingRange(credentials: FactusOAuthCredentials, input: FactusNumberingRangeInput): Promise<number>;

  /** Sube el logo de la empresa a Factus a partir de la URL ya cargada en `Company.logoUrl`.
   * No bloqueante: si falla o no hay logo, se ignora (el logo no es necesario para poder
   * facturar) -- el caller decide si audita el fallo. */
  uploadLogo(credentials: FactusOAuthCredentials, logoUrl: string): Promise<void>;
}
