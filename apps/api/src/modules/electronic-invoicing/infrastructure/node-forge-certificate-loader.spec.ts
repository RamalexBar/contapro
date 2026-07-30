import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateTestCertificate } from "./__fixtures__/self-signed-cert";
import { NodeForgeCertificateLoader } from "./node-forge-certificate-loader";
import { CertificateError } from "../../../shared/errors/app-error";

describe("NodeForgeCertificateLoader", () => {
  let dir: string;
  let p12Path: string;
  const cert = generateTestCertificate("test1234");

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "dian-cert-test-"));
    p12Path = join(dir, "test.p12");
    writeFileSync(p12Path, cert.p12Der);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("loads a valid PKCS#12 file and returns PEM key/cert", async () => {
    const loader = new NodeForgeCertificateLoader();
    const result = await loader.load(p12Path, "test1234");

    expect(result.privateKeyPem).toContain("PRIVATE KEY");
    expect(result.certificatePem).toContain("CERTIFICATE");
  });

  it("throws CertificateError on wrong password", async () => {
    const loader = new NodeForgeCertificateLoader();
    await expect(loader.load(p12Path, "wrong-password")).rejects.toBeInstanceOf(CertificateError);
  });

  it("throws CertificateError on missing file", async () => {
    const loader = new NodeForgeCertificateLoader();
    await expect(loader.load(join(dir, "does-not-exist.p12"), "test1234")).rejects.toBeInstanceOf(CertificateError);
  });
});
