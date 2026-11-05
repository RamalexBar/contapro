import { createHash, createHmac } from "node:crypto";
import type { IObjectStorage } from "./object-storage";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

const sha256Hex = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data).digest();

/** Codifica cada tramo de la ruta como lo exige S3 (RFC 3986), sin tocar los "/". */
const encodePath = (path: string) =>
  path
    .split("/")
    .map((part) => encodeURIComponent(part).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`))
    .join("/");

export interface SignInput {
  method: string;
  host: string;
  /** Ruta ya codificada, ej. "/bucket/companies/x/foto.jpg". */
  path: string;
  /** Encabezados extra a firmar (ademas de host, x-amz-content-sha256 y x-amz-date). */
  headers?: Record<string, string>;
  payloadHash: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
  /** "20130524T000000Z" */
  amzDate: string;
}

/**
 * AWS Signature Version 4 (la que acepta R2, compatible con S3), escrita a mano para no cargar el SDK de AWS --
 * mismo criterio que las demas integraciones del repo (fetch directo). Probada con el ejemplo oficial de la
 * documentacion de S3 (ver r2-object-storage.spec.ts). Devuelve los encabezados que hay que mandar.
 */
export function signRequest(input: SignInput): Record<string, string> {
  const dateStamp = input.amzDate.slice(0, 8);
  const headers: Record<string, string> = {
    ...Object.fromEntries(Object.entries(input.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v.trim()])),
    host: input.host,
    "x-amz-content-sha256": input.payloadHash,
    "x-amz-date": input.amzDate,
  };
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((n) => `${n}:${headers[n]}\n`).join("");
  const signedHeaders = names.join(";");
  const canonicalRequest = [input.method, input.path, "", canonicalHeaders, signedHeaders, input.payloadHash].join("\n");
  const scope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", input.amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, dateStamp), input.region), input.service), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

/**
 * Cloudflare R2 (API compatible con S3): https://<cuenta>.r2.cloudflarestorage.com/<bucket>/<llave>, region "auto".
 * El bucket es privado: las fotos las sirve la API por su direccion firmada, no R2 directo.
 */
export class R2ObjectStorage implements IObjectStorage {
  private readonly host: string;

  constructor(private readonly config: R2Config) {
    this.host = `${config.accountId}.r2.cloudflarestorage.com`;
  }

  private async request(method: string, key: string, body?: Buffer, contentType?: string): Promise<Response> {
    const path = `/${encodePath(this.config.bucket)}/${encodePath(key)}`;
    const amzDate = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const headers = signRequest({
      method,
      host: this.host,
      path,
      headers: contentType ? { "content-type": contentType } : {},
      payloadHash: sha256Hex(body ?? ""),
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      region: "auto",
      service: "s3",
      amzDate,
    });
    delete headers.host; // fetch lo pone solo
    return fetch(`https://${this.host}${path}`, { method, headers, body: body ? new Uint8Array(body) : undefined });
  }

  async put(key: string, contentType: string, data: Buffer): Promise<void> {
    const res = await this.request("PUT", key, data, contentType);
    if (!res.ok) throw new Error(`Cloudflare R2 no guardo el archivo (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }

  async get(key: string): Promise<Buffer | null> {
    const res = await this.request("GET", key);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Cloudflare R2 no entrego el archivo (${res.status}): ${(await res.text()).slice(0, 300)}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const res = await this.request("DELETE", key);
    if (!res.ok && res.status !== 404) throw new Error(`Cloudflare R2 no borro el archivo (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
}
