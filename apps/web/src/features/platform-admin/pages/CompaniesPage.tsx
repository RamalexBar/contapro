import { useState } from "react";
import type { ChangeEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { PlatformAdminLayout } from "../components/PlatformAdminLayout";
import { listCompanies, sendFactusActivationRequest } from "../api/saas-admin.api";
import type { CompanyWithSubscriptionRecord, FactusActivationAttachmentInput, FactusActivationMediaType } from "../api/saas-admin.api";

const ACCEPTED_MEDIA_TYPES: Record<string, FactusActivationMediaType> = {
  "application/pdf": "application/pdf",
  "image/jpeg": "image/jpeg",
  "image/png": "image/png",
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // FileReader.readAsDataURL da "data:<mime>;base64,<datos>" -- la API solo quiere <datos>.
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

async function toAttachment(file: File): Promise<FactusActivationAttachmentInput> {
  const mediaType = ACCEPTED_MEDIA_TYPES[file.type];
  if (!mediaType) throw new Error(`Formato no soportado: ${file.name} (solo PDF, JPG o PNG)`);
  return { filename: file.name, mediaType, base64: await fileToBase64(file) };
}

interface FileSlotProps {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}

function FileSlot({ label, file, onChange }: FileSlotProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.files?.[0] ?? null)}
        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
      />
      {file && <span className="mt-1 block text-xs text-success-600">{file.name}</span>}
    </label>
  );
}

/** Panel interno (no autoservicio del cliente): un operador de Contapro recibe por WhatsApp/correo
 * los 5 documentos de activacion de un NIT nuevo y los carga aca -- el backend arma el correo con
 * los adjuntos y lo manda a activacion@factus.com.co (ver SendFactusActivationRequestUseCase). No
 * hay paso de "el cliente sube sus propios documentos" -- decision explicita, ver memoria del
 * proyecto (contact-channel-pending / factus-qa-answers). */
interface FactusActivationFormProps {
  company: CompanyWithSubscriptionRecord;
  onSuccess: () => void;
  onCancel: () => void;
}

function FactusActivationForm({ company, onSuccess, onCancel }: FactusActivationFormProps) {
  const [integrationVersion, setIntegrationVersion] = useState<"v1" | "v2">("v2");
  const [isPersonaNatural, setIsPersonaNatural] = useState(false);
  const [rut, setRut] = useState<File | null>(null);
  const [legalRepCertificate, setLegalRepCertificate] = useState<File | null>(null);
  const [legalRepId, setLegalRepId] = useState<File | null>(null);
  const [purchaseProof, setPurchaseProof] = useState<File | null>(null);
  const [logo, setLogo] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!rut || !legalRepId || !purchaseProof || !logo) throw new Error("Faltan documentos obligatorios");
      if (!isPersonaNatural && !legalRepCertificate) throw new Error("Falta el certificado de representación legal (o marcá \"Persona natural\")");
      return sendFactusActivationRequest(company.companyId, {
        integrationVersion,
        rut: await toAttachment(rut),
        legalRepCertificate: isPersonaNatural ? null : await toAttachment(legalRepCertificate as File),
        legalRepId: await toAttachment(legalRepId),
        purchaseProof: await toAttachment(purchaseProof),
        logo: await toAttachment(logo),
      });
    },
    onSuccess,
  });

  return (
    <Card className="mt-4">
      <h2 className="font-semibold text-slate-900">Solicitar activación Factus — {company.companyName}</h2>
      <p className="mt-1 text-sm text-slate-500">
        NIT {company.nit}. Se manda un correo con los adjuntos a activacion@factus.com.co.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label="Versión de integración" value={integrationVersion} onChange={(e) => setIntegrationVersion(e.target.value as "v1" | "v2")}>
          <option value="v2">v2</option>
          <option value="v1">v1</option>
        </Select>

        <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
          <input type="checkbox" checked={isPersonaNatural} onChange={(e) => setIsPersonaNatural(e.target.checked)} />
          Persona natural (sin certificado de representación legal)
        </label>

        <FileSlot label="RUT actualizado" file={rut} onChange={setRut} />
        {!isPersonaNatural && (
          <FileSlot label="Certificado de existencia y representación legal" file={legalRepCertificate} onChange={setLegalRepCertificate} />
        )}
        <FileSlot label="Cédula del representante legal" file={legalRepId} onChange={setLegalRepId} />
        <FileSlot label="Comprobante de compra del paquete/certificado" file={purchaseProof} onChange={setPurchaseProof} />
        <FileSlot label="Logo (PNG o JPG)" file={logo} onChange={setLogo} />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>
          Enviar a Factus
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={mutation.isPending}>
          Cancelar
        </Button>
      </div>

      {mutation.isError && (
        <Alert tone="danger" className="mt-3">
          {(mutation.error as Error).message}
        </Alert>
      )}
    </Card>
  );
}

export function CompaniesPage() {
  const { data, isLoading } = useQuery({ queryKey: ["saas-admin", "companies"], queryFn: listCompanies });
  const [activationCompanyId, setActivationCompanyId] = useState<string | null>(null);
  const [justSentFor, setJustSentFor] = useState<string | null>(null);

  const activationCompany = data?.data.find((c) => c.companyId === activationCompanyId) ?? null;

  return (
    <PlatformAdminLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Empresas</h1>
      <Card noPadding>
        {isLoading ? (
          <Spinner />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Empresa</Th>
                <Th>NIT</Th>
                <Th>Activa</Th>
                <Th>Suscripcion</Th>
                <Th>Plan</Th>
                <Th>Registrada</Th>
                <Th>Vence</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((c) => (
                <TableRow key={c.companyId}>
                  <Td>{c.companyName}</Td>
                  <Td>{c.nit}</Td>
                  <Td>
                    <Badge tone={c.isActive ? "success" : "neutral"}>{c.isActive ? "Si" : "No"}</Badge>
                  </Td>
                  <Td>{c.subscriptionStatus ?? "-"}</Td>
                  <Td>{c.planName ?? "-"}</Td>
                  <Td>{c.registeredAt.slice(0, 10)}</Td>
                  <Td>{c.currentPeriodEnd ? c.currentPeriodEnd.slice(0, 10) : "-"}</Td>
                  <Td>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setJustSentFor(null);
                        setActivationCompanyId(c.companyId);
                      }}
                    >
                      Solicitar activación Factus
                    </Button>
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {justSentFor && (
        <Alert tone="success" className="mt-4">
          Solicitud de activación enviada a activacion@factus.com.co.
        </Alert>
      )}

      {activationCompany && (
        <FactusActivationForm
          company={activationCompany}
          onSuccess={() => {
            setJustSentFor(activationCompany.companyId);
            setActivationCompanyId(null);
          }}
          onCancel={() => setActivationCompanyId(null)}
        />
      )}
    </PlatformAdminLayout>
  );
}
