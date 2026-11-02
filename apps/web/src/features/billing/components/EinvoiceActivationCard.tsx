import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, MessageCircle } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { WHATSAPP_NUMBER } from "../../../components/ui/ContactWidget";
import { trackEvent } from "../../../lib/analytics";
import { getCompanyProfile } from "../../company/api/company.api";

type PersonType = "company" | "natural";

/** Lo que Factus pide para activar el NIT (lo mismo que el operador sube en Panel → Empresas). */
function documents(personType: PersonType, hasSignature: boolean | null, hasLogo: boolean) {
  return [
    "RUT actualizado (con la responsabilidad de facturador electrónico)",
    personType === "company" ? "Cédula del representante legal (por ambos lados)" : "Su cédula (por ambos lados)",
    ...(personType === "company" ? ["Certificado de existencia y representación legal (Cámara de Comercio) reciente"] : []),
    ...(hasLogo ? [] : ["Logo de su negocio (PNG o JPG), sale en sus facturas"]),
    ...(hasSignature ? ["Los datos de su firma electrónica actual (con qué empresa la tiene y hasta cuándo)"] : []),
  ];
}

/**
 * Después de pagar: «Siguiente paso: active su factura electrónica». El cliente ve qué documentos mandar y los
 * envía por WhatsApp; el operador los sube en Panel → Empresas → «Enviar documentos a Factus». Igual que en Cajapro.
 * Las respuestas no se guardan: van en el mensaje de WhatsApp, y los datos de la empresa ya están en su perfil.
 */
export function EinvoiceActivationCard() {
  const { data: profile } = useQuery({ queryKey: ["company-profile"], queryFn: getCompanyProfile });
  const [personType, setPersonType] = useState<PersonType>("company");
  const [hasSignature, setHasSignature] = useState<boolean | null>(null);

  const docs = documents(personType, hasSignature, Boolean(profile?.logoUrl));
  const message = [
    "Hola, ya pagué Contapro y quiero activar la factura electrónica.",
    // Algunas empresas guardan el NIT ya con el dígito de verificación ("900123456-7")
    profile ? `Empresa: ${profile.legalName || profile.name} · NIT ${profile.nit}${profile.dv && !profile.nit.includes("-") ? `-${profile.dv}` : ""}` : null,
    `Factura como: ${personType === "company" ? "empresa (sociedad)" : "persona natural"}`,
    hasSignature === null ? null : `Firma electrónica: ${hasSignature ? "ya la tengo" : "no la tengo"}`,
    "Le envío los documentos:",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="mb-6 space-y-4 rounded-xl bg-warning-50 p-4 ring-1 ring-warning-200">
      <div>
        <p className="flex items-center gap-2 font-semibold text-slate-900">
          <FileText size={18} /> Siguiente paso: active su factura electrónica
        </p>
        <p className="text-sm text-slate-700">
          Para facturar ante la DIAN necesitamos unos documentos suyos. Responda estas dos preguntas y envíelos por WhatsApp: nosotros hacemos la
          activación (toma de 1 a 3 días hábiles).
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-900">¿Factura como…?</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={personType === "company" ? "primary" : "secondary"} onClick={() => setPersonType("company")}>
            Empresa (sociedad)
          </Button>
          <Button size="sm" variant={personType === "natural" ? "primary" : "secondary"} onClick={() => setPersonType("natural")}>
            Persona natural
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-900">¿Ya tiene firma electrónica?</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={hasSignature === true ? "primary" : "secondary"} onClick={() => setHasSignature(true)}>
            Sí, ya la tengo
          </Button>
          <Button size="sm" variant={hasSignature === false ? "primary" : "secondary"} onClick={() => setHasSignature(false)}>
            No la tengo
          </Button>
        </div>
      </div>

      <div className="rounded-lg bg-white p-3 ring-1 ring-warning-200">
        <p className="text-sm font-medium text-slate-900">Documentos para enviar</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
          {docs.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          Si su RUT no tiene la responsabilidad de facturador electrónico, actualícelo primero en la DIAN: sin ella no se puede activar.
        </p>
      </div>

      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackEvent("contact_whatsapp", { placement: "einvoice_activation" })}
        className="inline-flex items-center gap-1.5 rounded-lg bg-success-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-success-700"
      >
        <MessageCircle size={16} /> Enviar documentos por WhatsApp
      </a>
    </div>
  );
}
