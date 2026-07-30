/**
 * ADVERTENCIA: esta es la parte MAS especulativa de todo el modulo DIAN -- mas incluso que el
 * documento soporte. La nomina electronica (Resolucion 000013 de 2021) usa un esquema XML propio
 * de la DIAN, que NO es UBL (a diferencia de factura/notas/documento soporte, que sí lo son) y
 * tiene mucha menos documentacion publica disponible para contrastar. La estructura de bloques
 * usada aqui (Empleador/Trabajador/Periodo/Pago/Devengados/Deducciones) es una aproximacion de
 * mejor esfuerzo basada en la forma general conocida del documento, NO una implementacion
 * confirmada contra el XSD/Anexo Tecnico real. Tratar como placeholder hasta poder contrastar
 * con un ejemplo real de la DIAN.
 *
 * Limitacion explicita: el motor de calculo de nomina actual (payroll-calculator.ts) no calcula
 * retencion en la fuente -- ese nodo queda siempre en 0. No se inventa un calculo nuevo aqui.
 */
export interface DianPayrollLine {
  conceptCode: string;
  amount: number;
}

export interface DianPayrollEmployee {
  documentType: string;
  documentNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  secondLastName: string | null;
  workerType: string;
  workerSubtype: string;
  contractTypeCode: string;
  position: string;
  hireDate: Date;
  salary: number;
}

export interface DianPayrollInput {
  fullNumber: string;
  cune: string;
  issueDate: Date;
  periodStart: Date;
  periodEnd: Date;
  environment: "HABILITACION" | "PRODUCCION";
  employer: { nit: string; legalName: string; municipalityCode: string | null };
  employee: DianPayrollEmployee;
  earnings: DianPayrollLine[]; // devengados (SALARY, TRANSPORT_ALLOWANCE, OVERTIME_*, *_SURCHARGE)
  deductions: DianPayrollLine[]; // deducciones (HEALTH_EMPLOYEE, PENSION_EMPLOYEE)
  grossTotal: number;
  totalDeductions: number;
  netPay: number;
}

const EARNING_CONCEPT_TAGS: Record<string, string> = {
  SALARY: "SueldoTrabajado",
  TRANSPORT_ALLOWANCE: "AuxilioTransporte",
  OVERTIME_DAY: "HorasExtraDiurnas",
  OVERTIME_NIGHT: "HorasExtraNocturnas",
  NIGHT_SURCHARGE: "RecargoNocturno",
  SUNDAY_SURCHARGE: "RecargoDominicalFestivo",
};

const DEDUCTION_CONCEPT_TAGS: Record<string, string> = {
  HEALTH_EMPLOYEE: "Salud",
  PENSION_EMPLOYEE: "FondoPension",
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildEarningLines(lines: DianPayrollLine[]): string {
  return lines
    .map((line) => {
      const tag = EARNING_CONCEPT_TAGS[line.conceptCode];
      if (!tag) return ""; // conceptCode sin mapeo conocido a un nodo DIAN -- se omite, no se inventa uno
      return `\n    <${tag}>${line.amount.toFixed(2)}</${tag}>`;
    })
    .join("");
}

function buildDeductionLines(lines: DianPayrollLine[]): string {
  return lines
    .map((line) => {
      const tag = DEDUCTION_CONCEPT_TAGS[line.conceptCode];
      if (!tag) return "";
      return `\n    <${tag}>${line.amount.toFixed(2)}</${tag}>`;
    })
    .join("");
}

/**
 * Construye un XML best-effort para un documento individual de nomina electronica. NO validado
 * contra ningun XSD oficial de la DIAN -- ver aviso de cabecera.
 */
export function buildDianPayrollXml(input: DianPayrollInput): string {
  const issueDateStr = input.issueDate.toISOString().slice(0, 10);
  const periodStartStr = input.periodStart.toISOString().slice(0, 10);
  const periodEndStr = input.periodEnd.toISOString().slice(0, 10);
  const hireDateStr = input.employee.hireDate.toISOString().slice(0, 10);
  const profileLabel =
    input.environment === "PRODUCCION"
      ? "DIAN 2.1: Nomina Electronica Individual"
      : "DIAN 2.1: Nomina Electronica Individual (habilitacion)";

  return `<?xml version="1.0" encoding="UTF-8"?>
<NominaIndividual>
  <ID>${escapeXml(input.fullNumber)}</ID>
  <CUNE>${input.cune}</CUNE>
  <FechaGeneracion>${issueDateStr}</FechaGeneracion>
  <ProfileID>${escapeXml(profileLabel)}</ProfileID>
  <Periodo>
    <FechaIngreso>${hireDateStr}</FechaIngreso>
    <FechaInicioLiquidacion>${periodStartStr}</FechaInicioLiquidacion>
    <FechaFinLiquidacion>${periodEndStr}</FechaFinLiquidacion>
  </Periodo>
  <Empleador>
    <NIT>${escapeXml(input.employer.nit)}</NIT>
    <RazonSocial>${escapeXml(input.employer.legalName)}</RazonSocial>
    <CodigoMunicipio>${escapeXml(input.employer.municipalityCode ?? "")}</CodigoMunicipio>
  </Empleador>
  <Trabajador>
    <TipoDocumento>${escapeXml(input.employee.documentType)}</TipoDocumento>
    <NumeroDocumento>${escapeXml(input.employee.documentNumber)}</NumeroDocumento>
    <PrimerApellido>${escapeXml(input.employee.lastName)}</PrimerApellido>
    <SegundoApellido>${escapeXml(input.employee.secondLastName ?? "")}</SegundoApellido>
    <PrimerNombre>${escapeXml(input.employee.firstName)}</PrimerNombre>
    <OtrosNombres>${escapeXml(input.employee.middleName ?? "")}</OtrosNombres>
    <TipoTrabajador>${escapeXml(input.employee.workerType)}</TipoTrabajador>
    <SubTipoTrabajador>${escapeXml(input.employee.workerSubtype)}</SubTipoTrabajador>
    <TipoContrato>${escapeXml(input.employee.contractTypeCode)}</TipoContrato>
    <Cargo>${escapeXml(input.employee.position)}</Cargo>
    <SueldoBase currencyID="COP">${input.employee.salary.toFixed(2)}</SueldoBase>
  </Trabajador>
  <Devengados>${buildEarningLines(input.earnings)}
    <TotalDevengado currencyID="COP">${input.grossTotal.toFixed(2)}</TotalDevengado>
  </Devengados>
  <Deducciones>${buildDeductionLines(input.deductions)}
    <RetencionFuente currencyID="COP">0.00</RetencionFuente>
    <TotalDeducciones currencyID="COP">${input.totalDeductions.toFixed(2)}</TotalDeducciones>
  </Deducciones>
  <ComprobanteTotal>
    <TotalDevengado currencyID="COP">${input.grossTotal.toFixed(2)}</TotalDevengado>
    <TotalDeducciones currencyID="COP">${input.totalDeductions.toFixed(2)}</TotalDeducciones>
    <ComprobanteNeto currencyID="COP">${input.netPay.toFixed(2)}</ComprobanteNeto>
  </ComprobanteTotal>
</NominaIndividual>`;
}
