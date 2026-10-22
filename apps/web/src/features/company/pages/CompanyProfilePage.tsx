import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { getCompanyProfile, updateCompanyProfile } from "../api/company.api";
import { listBranches, updateBranch, type BranchRecord } from "../../inventory/api/branch.api";

const FIELD_LABELS: Record<string, string> = {
  documentType: "Tipo de persona",
  dv: "Dígito de verificación",
  taxRegime: "IVA",
  fiscalResponsibilities: "Responsabilidades (casilla 53 del RUT)",
  address: "Dirección",
  municipality: "Ciudad o municipio",
  department: "Departamento",
};

const IVA_OPTIONS = ["Responsable de IVA", "No responsable de IVA"];

// Casilla 53 del RUT. R-99-PN ("no aplica") excluye a las demas.
const RESPONSIBILITIES = [
  { code: "O-13", label: "Gran contribuyente" },
  { code: "O-15", label: "Autorretenedor" },
  { code: "O-23", label: "Agente de retención IVA" },
  { code: "O-47", label: "Régimen simple de tributación" },
  { code: "R-99-PN", label: "No aplica – otros" },
];
const NOT_APPLICABLE = "R-99-PN";

// El logo se guarda en la base de datos como data URL: se reduce aqui antes de enviarlo.
const LOGO_MAX_SIDE = 400;
const LOGO_MAX_DATA_URL_LENGTH = 400_000;

interface FormState {
  name: string;
  legalName: string;
  documentType: string;
  nit: string;
  dv: string;
  economicActivity: string;
  taxRegime: string;
  responsibilities: string[];
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  instagram: string;
  address: string;
  municipality: string;
  department: string;
  municipalityCode: string;
  receiptHeader: string;
  receiptFooter: string;
  logoUrl: string | null;
}

const EMPTY_FORM: FormState = {
  name: "",
  legalName: "",
  documentType: "NIT",
  nit: "",
  dv: "",
  economicActivity: "",
  taxRegime: "",
  responsibilities: [],
  phone: "",
  whatsapp: "",
  email: "",
  website: "",
  instagram: "",
  address: "",
  municipality: "",
  department: "",
  municipalityCode: "",
  receiptHeader: "",
  receiptFooter: "",
  logoUrl: null,
};

/** "O-13, O-23" -> ["O-13", "O-23"]; tolera texto libre viejo (se ignora lo que no sea un codigo). */
function parseResponsibilities(value: string | null): string[] {
  return value?.match(/O-\d+|R-99-PN/g) ?? [];
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

/** Reduce el logo a LOGO_MAX_SIDE px; PNG conserva la transparencia, JPG se comprime. */
async function shrinkLogo(file: File): Promise<string> {
  const original = await readFileAsDataUrl(file);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("El archivo no es una imagen válida"));
    img.src = original;
  });
  const scale = Math.min(1, LOGO_MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen");
  const isPng = file.type === "image/png";
  if (!isPng) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let dataUrl = isPng ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.85);
  if (dataUrl.length > LOGO_MAX_DATA_URL_LENGTH) dataUrl = canvas.toDataURL("image/jpeg", 0.7);
  if (dataUrl.length > LOGO_MAX_DATA_URL_LENGTH) throw new Error("El logo es muy pesado; usa una imagen más sencilla");
  return dataUrl;
}

function Section({ title, description, children }: PropsWithChildren<{ title: string; description?: string }>) {
  return (
    <Card title={title} className="mb-4">
      {description && <p className="-mt-1 mb-3 text-xs text-slate-500">{description}</p>}
      <div className="space-y-3">{children}</div>
    </Card>
  );
}

function Choice({ checked, onChange, children, type = "radio" }: PropsWithChildren<{ checked: boolean; onChange: () => void; type?: "radio" | "checkbox" }>) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
        checked ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-700 hover:bg-slate-50"
      }`}
    >
      <input type={type} className="h-4 w-4" checked={checked} onChange={onChange} />
      {children}
    </label>
  );
}

function TextArea({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <textarea
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        rows={2}
        maxLength={300}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

/** Una sede (sucursal) editable: nombre, direccion y telefono. */
function BranchEditor({ branch, canManage }: { branch: BranchRecord; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: branch.name, address: branch.address ?? "", phone: branch.phone ?? "" });
  const [saved, setSaved] = useState(false);
  const mutation = useMutation({
    mutationFn: () => updateBranch(branch.id, { name: form.name, address: form.address || null, phone: form.phone || null }),
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
  });
  const set = (key: keyof typeof form, value: string) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input label={branch.isMain ? "Nombre de la sede (principal)" : "Nombre de la sede"} value={form.name} onChange={(e) => set("name", e.target.value)} disabled={!canManage} />
        <Input label="Dirección" value={form.address} onChange={(e) => set("address", e.target.value)} disabled={!canManage} />
        <Input label="Teléfono de la sede" value={form.phone} onChange={(e) => set("phone", e.target.value)} disabled={!canManage} />
      </div>
      {canManage && (
        <div className="mt-2 flex items-center gap-3">
          <Button size="sm" variant="secondary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Guardar sede
          </Button>
          {saved && <span className="text-xs text-emerald-600">Guardada.</span>}
          {mutation.isError && <span className="text-xs text-red-600">{(mutation.error as Error).message}</span>}
        </div>
      )}
    </div>
  );
}

export function CompanyProfilePage() {
  const queryClient = useQueryClient();
  const canManage = useAuthStore((s) => s.hasPermission("electronic-invoicing.manage"));
  const canManageBranches = useAuthStore((s) => s.hasPermission("branch.manage"));
  const { data, isLoading } = useQuery({ queryKey: ["company-profile"], queryFn: getCompanyProfile });
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: listBranches });

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saved, setSaved] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  // Sincroniza el formulario con lo que devuelve el servidor la primera vez que carga.
  useEffect(() => {
    if (!data) return;
    setForm({
      name: data.name,
      legalName: data.legalName,
      documentType: data.documentType ?? "NIT",
      nit: data.nit,
      dv: data.dv ?? "",
      economicActivity: data.economicActivity ?? "",
      taxRegime: data.taxRegime ?? "",
      responsibilities: parseResponsibilities(data.fiscalResponsibilities),
      phone: data.phone ?? "",
      whatsapp: data.whatsapp ?? "",
      email: data.email,
      website: data.website ?? "",
      instagram: data.instagram ?? "",
      address: data.address ?? "",
      municipality: data.municipality ?? "",
      department: data.department ?? "",
      municipalityCode: data.municipalityCode ?? "",
      receiptHeader: data.receiptHeader ?? "",
      receiptFooter: data.receiptFooter ?? "",
      logoUrl: data.logoUrl,
    });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateCompanyProfile({
        name: form.name,
        legalName: form.legalName,
        // Solo si cambio: hay empresas registradas con "NIT-DV" junto, que el validador ya no acepta.
        nit: form.nit !== data?.nit ? form.nit : undefined,
        email: form.email,
        documentType: form.documentType || null,
        dv: form.dv || null,
        economicActivity: form.economicActivity || null,
        taxRegime: form.taxRegime || null,
        fiscalResponsibilities: form.responsibilities.length > 0 ? form.responsibilities.join(", ") : null,
        phone: form.phone || null,
        whatsapp: form.whatsapp || null,
        website: form.website || null,
        instagram: form.instagram || null,
        address: form.address || null,
        municipality: form.municipality || null,
        department: form.department || null,
        municipalityCode: form.municipalityCode || null,
        receiptHeader: form.receiptHeader || null,
        receiptFooter: form.receiptFooter || null,
        logoUrl: form.logoUrl,
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

  function toggleResponsibility(code: string) {
    const has = form.responsibilities.includes(code);
    if (has) return set("responsibilities", form.responsibilities.filter((c) => c !== code));
    set("responsibilities", code === NOT_APPLICABLE ? [code] : [...form.responsibilities.filter((c) => c !== NOT_APPLICABLE), code]);
  }

  async function handleLogo(file: File | undefined) {
    if (!file) return;
    setLogoError(null);
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setLogoError("Sube el logo en PNG o JPG");
      return;
    }
    try {
      set("logoUrl", await shrinkLogo(file));
    } catch (err) {
      setLogoError((err as Error).message);
    }
  }

  const disabled = !canManage;

  return (
    <AppLayout>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Datos del negocio</h1>
      <p className="mb-4 max-w-3xl text-sm text-slate-500">
        Lo que escribas aquí sale en el tiquete y en los comprobantes. El tiquete es un documento interno; la factura electrónica
        ante la DIAN la emite ContaPro cuando el negocio la tiene conectada.
      </p>

      {isLoading ? (
        <Spinner />
      ) : (
        <form
          className="max-w-3xl"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          {data && !data.complete && (
            <Alert tone="warning" className="mb-4">
              Faltan por completar: {data.missingFields.map((f) => FIELD_LABELS[f] ?? f).join(", ")}.
            </Alert>
          )}
          {!canManage && (
            <Alert tone="info" className="mb-4">
              No tienes permiso para editar estos datos.
            </Alert>
          )}

          <Section title="Identidad">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="Logo del negocio" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-slate-400">Sin logo</span>
                )}
              </div>
              {canManage && (
                <div>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => logoInput.current?.click()}>
                      {form.logoUrl ? "Cambiar logo" : "Subir logo"}
                    </Button>
                    {form.logoUrl && (
                      <Button type="button" variant="secondary" size="sm" onClick={() => set("logoUrl", null)}>
                        Quitar
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">PNG o JPG. En la impresora térmica sale en blanco y negro.</p>
                  {logoError && <p className="mt-1 text-xs text-red-600">{logoError}</p>}
                  <input
                    ref={logoInput}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                      handleLogo(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}
            </div>

            <Input label="Nombre comercial (el que ve el cliente)" value={form.name} onChange={(e) => set("name", e.target.value)} disabled={disabled} required />
            <Input label="Razón social" hint="Como aparece en el RUT" value={form.legalName} onChange={(e) => set("legalName", e.target.value)} disabled={disabled} required />
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">Tipo de persona</span>
              <div className="flex flex-wrap gap-2">
                <Choice checked={form.documentType === "CC"} onChange={() => !disabled && set("documentType", "CC")}>
                  Persona natural
                </Choice>
                <Choice checked={form.documentType === "NIT"} onChange={() => !disabled && set("documentType", "NIT")}>
                  Persona jurídica
                </Choice>
              </div>
            </div>
          </Section>

          <Section title="Datos fiscales (RUT)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_6rem_1fr]">
              <Input
                label={form.documentType === "CC" ? "Cédula o NIT (sin dígito de verificación)" : "NIT (sin dígito de verificación)"}
                hint="Si ya emitiste facturas electrónicas, no se puede cambiar."
                value={form.nit}
                onChange={(e) => set("nit", e.target.value)}
                disabled={disabled}
                required
              />
              <Input label="DV" value={form.dv} onChange={(e) => set("dv", e.target.value)} disabled={disabled} maxLength={1} />
              <Input label="Actividad económica (CIIU)" placeholder="Ej. 4711" value={form.economicActivity} onChange={(e) => set("economicActivity", e.target.value)} disabled={disabled} />
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">IVA</span>
              <div className="flex flex-wrap gap-2">
                {IVA_OPTIONS.map((option) => (
                  <Choice key={option} checked={form.taxRegime === option} onChange={() => !disabled && set("taxRegime", option)}>
                    {option}
                  </Choice>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">Responsabilidades (casilla 53 del RUT)</span>
              <div className="flex flex-wrap gap-2">
                {RESPONSIBILITIES.map((r) => (
                  <Choice key={r.code} type="checkbox" checked={form.responsibilities.includes(r.code)} onChange={() => !disabled && toggleResponsibility(r.code)}>
                    <span className="font-medium">{r.code}</span> {r.label}
                  </Choice>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Contacto">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Teléfono general" value={form.phone} onChange={(e) => set("phone", e.target.value)} disabled={disabled} />
              <Input label="WhatsApp" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} disabled={disabled} />
              <Input label="Correo" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} disabled={disabled} required />
              <Input label="Página web" placeholder="www.minegocio.com" value={form.website} onChange={(e) => set("website", e.target.value)} disabled={disabled} />
              <Input label="Instagram" placeholder="@minegocio" value={form.instagram} onChange={(e) => set("instagram", e.target.value)} disabled={disabled} />
            </div>
          </Section>

          <Section title="Dirección principal" description="Sale en el tiquete y en el encabezado de las facturas.">
            <Input label="Dirección" value={form.address} onChange={(e) => set("address", e.target.value)} disabled={disabled} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input label="Ciudad o municipio" placeholder="Pereira" value={form.municipality} onChange={(e) => set("municipality", e.target.value)} disabled={disabled} />
              <Input label="Departamento" value={form.department} onChange={(e) => set("department", e.target.value)} disabled={disabled} />
              <Input label="Código DANE (opcional)" value={form.municipalityCode} onChange={(e) => set("municipalityCode", e.target.value)} disabled={disabled} />
            </div>
          </Section>

          <Section title="Textos del tiquete">
            <TextArea
              label="Encabezado (opcional)"
              hint="Sale debajo de los datos del negocio. Ej. horario de atención"
              value={form.receiptHeader}
              onChange={(v) => !disabled && set("receiptHeader", v)}
            />
            <TextArea
              label="Pie del tiquete"
              hint={'Si lo dejas vacío, sale "GRACIAS POR SU COMPRA"'}
              value={form.receiptFooter}
              onChange={(v) => !disabled && set("receiptFooter", v)}
            />
          </Section>

          {canManage && (
            <div className="sticky bottom-0 z-10 -mx-1 mb-6 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-slate-50/95 px-1 py-3 backdrop-blur">
              <Button type="submit" loading={saveMutation.isPending}>
                Guardar cambios
              </Button>
              {saved && !saveMutation.isPending && <span className="text-sm text-emerald-600">Guardado.</span>}
              {saveMutation.isError && <span className="text-sm text-red-600">{(saveMutation.error as Error).message}</span>}
            </div>
          )}
        </form>
      )}

      {branches && branches.data.length > 0 && (
        <div className="max-w-3xl">
          <Section title="Sedes" description="Cada sede tiene su propio nombre, dirección y teléfono. Para crear sedes nuevas, ve a Inventario → Sucursales.">
            {branches.data.map((b) => (
              <BranchEditor key={b.id} branch={b} canManage={canManageBranches} />
            ))}
          </Section>
        </div>
      )}
    </AppLayout>
  );
}
