import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { getCompanyProfile, updateCompanyProfile } from "../api/company.api";

const FIELD_LABELS: Record<string, string> = {
  documentType: "Tipo de documento",
  dv: "Dígito de verificación",
  taxRegime: "Régimen tributario",
  fiscalResponsibilities: "Responsabilidad tributaria",
  address: "Dirección",
  municipality: "Municipio",
  department: "Departamento",
};

interface FormState {
  phone: string;
  documentType: string;
  dv: string;
  taxRegime: string;
  fiscalResponsibilities: string;
  address: string;
  municipality: string;
  department: string;
  municipalityCode: string;
}

const EMPTY_FORM: FormState = {
  phone: "",
  documentType: "NIT",
  dv: "",
  taxRegime: "",
  fiscalResponsibilities: "",
  address: "",
  municipality: "",
  department: "",
  municipalityCode: "",
};

export function CompanyProfilePage() {
  const queryClient = useQueryClient();
  const canManage = useAuthStore((s) => s.hasPermission("electronic-invoicing.manage"));
  const { data, isLoading } = useQuery({ queryKey: ["company-profile"], queryFn: getCompanyProfile });

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saved, setSaved] = useState(false);

  // Sincroniza el formulario con lo que devuelve el servidor la primera vez que carga.
  useEffect(() => {
    if (!data) return;
    setForm({
      phone: data.phone ?? "",
      documentType: data.documentType ?? "NIT",
      dv: data.dv ?? "",
      taxRegime: data.taxRegime ?? "",
      fiscalResponsibilities: data.fiscalResponsibilities ?? "",
      address: data.address ?? "",
      municipality: data.municipality ?? "",
      department: data.department ?? "",
      municipalityCode: data.municipalityCode ?? "",
    });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateCompanyProfile({
        phone: form.phone || null,
        documentType: form.documentType || null,
        dv: form.dv || null,
        taxRegime: form.taxRegime || null,
        fiscalResponsibilities: form.fiscalResponsibilities || null,
        address: form.address || null,
        municipality: form.municipality || null,
        department: form.department || null,
        municipalityCode: form.municipalityCode || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-profile"] });
      setSaved(true);
    },
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Datos de la empresa</h1>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Datos fiscales DIAN de tu empresa (tipo de documento, dígito de verificación, responsabilidad
        tributaria, ubicación). Se piden antes de poder crear tu primera{" "}
        <a href="/manual-invoices" className="text-brand-600 underline">
          factura manual
        </a>{" "}
        (sin punto de venta). No se envían a MATIAS si esa integración está activa — su identidad de
        emisor se configura directamente en su cuenta.
      </p>

      {isLoading ? (
        <Spinner />
      ) : (
        <Card title="Perfil fiscal" className="max-w-2xl">
          {data && !data.complete && (
            <Alert tone="warning" className="mb-4">
              Faltan por completar: {data.missingFields.map((f) => FIELD_LABELS[f] ?? f).join(", ")}.
            </Alert>
          )}

          {!canManage ? (
            <p className="text-sm text-slate-500">No tienes permiso para editar estos datos.</p>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Razón social" value={data?.legalName ?? ""} disabled />
                <Input label="NIT" value={data?.nit ?? ""} disabled />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Select label="Tipo de documento" value={form.documentType} onChange={(e) => set("documentType", e.target.value)}>
                  <option value="NIT">NIT (persona jurídica)</option>
                  <option value="CC">Cédula de ciudadanía (persona natural)</option>
                </Select>
                <Input label="Dígito de verificación (DV)" value={form.dv} onChange={(e) => set("dv", e.target.value)} />
              </div>

              <Input
                label="Responsabilidad tributaria"
                placeholder="ej. Responsable de IVA"
                value={form.fiscalResponsibilities}
                onChange={(e) => set("fiscalResponsibilities", e.target.value)}
              />
              <Input
                label="Régimen tributario"
                placeholder="ej. Régimen común"
                value={form.taxRegime}
                onChange={(e) => set("taxRegime", e.target.value)}
              />

              <Input label="Dirección" value={form.address} onChange={(e) => set("address", e.target.value)} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Municipio" value={form.municipality} onChange={(e) => set("municipality", e.target.value)} />
                <Input label="Departamento" value={form.department} onChange={(e) => set("department", e.target.value)} />
              </div>
              <Input
                label="Código DANE municipio (opcional)"
                value={form.municipalityCode}
                onChange={(e) => set("municipalityCode", e.target.value)}
              />
              <Input label="Teléfono" value={form.phone} onChange={(e) => set("phone", e.target.value)} />

              <Button type="submit" loading={saveMutation.isPending}>
                Guardar
              </Button>

              {saved && !saveMutation.isPending && (
                <Alert tone="info" className="mt-2">
                  Guardado.
                </Alert>
              )}
              {saveMutation.isError && (
                <Alert tone="danger" className="mt-2">
                  {(saveMutation.error as Error).message}
                </Alert>
              )}
            </form>
          )}
        </Card>
      )}
    </AppLayout>
  );
}
