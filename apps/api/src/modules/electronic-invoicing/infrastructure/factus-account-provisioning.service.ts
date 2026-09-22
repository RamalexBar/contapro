import { env } from "../../../config/env";
import type { FactusNumberingRangeInput, IFactusAccountProvisioner } from "../domain/factus-account-provisioner";
import { authenticateFactus, type FactusOAuthCredentials } from "./factus-auth";

/** Codigo de documento "21" = crear rango de facturacion electronica de venta (ver tabla de
 * codigos de documento en developers.factus.com.co/rangos-de-numeracion/facturación/crear-rango/). */
const DOCUMENT_CODE_SALES_INVOICE_RANGE = "21";

interface FactusNumberingRangeResponse {
  status?: string;
  message?: string;
  data?: { id?: number };
}

/**
 * Ver aviso completo en domain/factus-account-provisioner.ts: implementado siguiendo la
 * documentacion oficial de Factus, pero `POST /v2/numbering-ranges` y `POST /v2/companies/logo`
 * devuelven 500 en el sandbox compartido sin importar el request (probado 2026-09-21 con el
 * payload documentado exacto y con una imagen minima valida) -- sin verificar contra una cuenta
 * de Factus dedicada.
 */
export class FactusAccountProvisioningService implements IFactusAccountProvisioner {
  async createSalesNumberingRange(credentials: FactusOAuthCredentials, input: FactusNumberingRangeInput): Promise<number> {
    const accessToken = await authenticateFactus(credentials);

    const res = await fetch(`${env.FACTUS_BASE_URL}/v2/numbering-ranges`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        document: DOCUMENT_CODE_SALES_INVOICE_RANGE,
        prefix: input.prefix,
        resolution_number: input.resolutionNumber,
        current: input.current,
      }),
    });

    const raw = await res.text();
    if (!res.ok) {
      throw new Error(`Factus rechazo la creacion del rango de numeracion (status ${res.status}): ${raw.slice(0, 500)}`);
    }

    let parsed: FactusNumberingRangeResponse;
    try {
      parsed = JSON.parse(raw) as FactusNumberingRangeResponse;
    } catch {
      throw new Error(`Factus devolvio una respuesta no-JSON al crear el rango de numeracion (status ${res.status}): ${raw.slice(0, 500)}`);
    }

    const numberingRangeId = parsed.data?.id;
    if (!numberingRangeId) {
      throw new Error(`Factus no devolvio un id de rango de numeracion: ${raw.slice(0, 500)}`);
    }
    return numberingRangeId;
  }

  async uploadLogo(credentials: FactusOAuthCredentials, logoUrl: string): Promise<void> {
    const accessToken = await authenticateFactus(credentials);

    const imageRes = await fetch(logoUrl);
    if (!imageRes.ok) {
      throw new Error(`No se pudo descargar el logo desde ${logoUrl} (status ${imageRes.status})`);
    }
    const imageBlob = await imageRes.blob();

    const form = new FormData();
    form.append("image", imageBlob, "logo");

    const res = await fetch(`${env.FACTUS_BASE_URL}/v2/companies/logo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      body: form,
    });

    if (!res.ok) {
      const raw = await res.text();
      throw new Error(`Factus rechazo la subida del logo (status ${res.status}): ${raw.slice(0, 500)}`);
    }
  }
}
