import type { CreatePayrollDeductionInput, CreatePayrollInput, CreatePayrollParameterInput } from "@erp/shared-types";
import { apiFetch, BASE_URL } from "../../../lib/api-client";
import { useAuthStore } from "../../auth/hooks/useAuthStore";

export interface PayrollParameterRecord {
  id: string;
  year: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  minimumWage: number;
  transportAllowance: number;
  uvt: number;
  healthEmployeePercent: number;
  healthEmployerPercent: number;
  pensionEmployeePercent: number;
  pensionEmployerPercent: number;
  arlPercentByRiskLevel: Record<string, number>;
  severancePercent: number;
  severanceInterestPercent: number;
  serviceBonusPercent: number;
  vacationPercent: number;
  familyCompensationPercent: number;
  icbfPercent: number;
  senaPercent: number;
  overtimeDayPercent: number;
  overtimeNightPercent: number;
  nightSurchargePercent: number;
  sundayHolidaySurchargePercent: number;
  monthlyHoursDivisor: number;
  isActive: boolean;
}

export interface PayrollRecord {
  id: string;
  branchId: string | null;
  year: number;
  month: number;
  periodType: string;
  startDate: string;
  endDate: string;
  status: string;
  calculatedAt: string | null;
  paidAt: string | null;
}

export interface PayrollItem {
  id: string;
  conceptCode: string;
  quantity: number | null;
  rate: number | null;
  amount: number;
}

export interface PayrollDetail {
  id: string;
  employeeId: string;
  grossTotal: number;
  totalDeductions: number;
  netPay: number;
  employerCostTotal: number;
  status: string;
  items: PayrollItem[];
  payslip: { id: string; generatedAt: string; fileUrl: string | null; summaryJson: Record<string, unknown> } | null;
}

export interface PayrollWithDetails extends PayrollRecord {
  details: PayrollDetail[];
}

export function listPayrollParameters(): Promise<{ data: PayrollParameterRecord[] }> {
  return apiFetch("/payroll-parameters");
}

export function createPayrollParameter(input: CreatePayrollParameterInput): Promise<PayrollParameterRecord> {
  return apiFetch("/payroll-parameters", { method: "POST", body: input });
}

export interface PayrollSettings {
  /** Exoneracion de aportes del art. 114-1 E.T. (salud empleador, SENA, ICBF). */
  exemptArt1141: boolean;
}

export function getPayrollSettings(): Promise<PayrollSettings> {
  return apiFetch("/payroll-settings");
}

export function updatePayrollSettings(input: PayrollSettings): Promise<PayrollSettings> {
  return apiFetch("/payroll-settings", { method: "PUT", body: input });
}

export function listPayrolls(filter?: { year?: number }): Promise<{ data: PayrollRecord[] }> {
  const query = filter?.year ? `?year=${filter.year}` : "";
  return apiFetch(`/payrolls${query}`);
}

export function createPayroll(input: CreatePayrollInput): Promise<PayrollRecord> {
  return apiFetch("/payrolls", { method: "POST", body: input });
}

export function getPayroll(id: string): Promise<PayrollWithDetails> {
  return apiFetch(`/payrolls/${id}`);
}

export function calculatePayroll(id: string): Promise<PayrollRecord> {
  return apiFetch(`/payrolls/${id}/calculate`, { method: "POST" });
}

export function approvePayroll(id: string): Promise<PayrollRecord> {
  return apiFetch(`/payrolls/${id}/approve`, { method: "POST" });
}

export interface IssueElectronicPayrollResult {
  monthComplete: boolean;
  sent: number;
  failed: number;
  alreadyAccepted: number;
}

/** Emite (o reintenta) la nomina electronica del mes de esta nomina: un documento por empleado. */
export function issueElectronicPayroll(id: string): Promise<IssueElectronicPayrollResult> {
  return apiFetch(`/payrolls/${id}/electronic-payroll`, { method: "POST" });
}

export function payPayroll(id: string): Promise<PayrollRecord> {
  return apiFetch(`/payrolls/${id}/pay`, { method: "POST" });
}

export async function downloadPayslipPdf(payslipId: string, fileName: string): Promise<void> {
  const { accessToken } = useAuthStore.getState();
  const res = await fetch(`${BASE_URL}/payslips/${payslipId}/pdf`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) throw new Error("No se pudo descargar el desprendible");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export interface WhatsAppDeliveryRecord {
  id: string;
  messageType: string;
  recipientPhone: string;
  success: boolean;
  errorMessage: string | null;
  sentAt: string;
}

export function listPayslipWhatsAppDeliveries(payslipId: string): Promise<{ data: WhatsAppDeliveryRecord[] }> {
  return apiFetch(`/payslips/${payslipId}/whatsapp-deliveries`);
}

export function resendPayslipWhatsApp(payslipId: string): Promise<void> {
  return apiFetch(`/payslips/${payslipId}/whatsapp/resend`, { method: "POST" });
}

export interface PayrollDeductionRecord {
  id: string;
  employeeId: string;
  type: "LOAN_DEDUCTION" | "GARNISHMENT";
  description: string;
  amountPerPeriod: number;
  totalAmount: number | null;
  remainingBalance: number | null;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  startDate: string;
  createdAt: string;
}

export function listPayrollDeductions(filter?: { employeeId?: string; status?: string }): Promise<{ data: PayrollDeductionRecord[] }> {
  const params = new URLSearchParams();
  if (filter?.employeeId) params.set("employeeId", filter.employeeId);
  if (filter?.status) params.set("status", filter.status);
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiFetch(`/payroll-deductions${query}`);
}

export function createPayrollDeduction(input: CreatePayrollDeductionInput): Promise<PayrollDeductionRecord> {
  return apiFetch("/payroll-deductions", { method: "POST", body: input });
}

export function cancelPayrollDeduction(id: string): Promise<PayrollDeductionRecord> {
  return apiFetch(`/payroll-deductions/${id}/cancel`, { method: "POST" });
}

// ---- Prestaciones sociales: prima, cesantias y liquidacion del contrato ----
export type BenefitSettlementType = "SERVICE_BONUS" | "SEVERANCE" | "TERMINATION";
export type TerminationReason = "RESIGNATION" | "JUST_CAUSE" | "WITHOUT_JUST_CAUSE" | "END_OF_TERM" | "MUTUAL_AGREEMENT";

export type SettleBenefitsInput =
  | { type: "SERVICE_BONUS"; year: number; semester: 1 | 2 }
  | { type: "SEVERANCE"; year: number }
  | { type: "TERMINATION"; employeeId: string; reason: TerminationReason; fixedTermEndDate?: string };

export interface BenefitLine {
  concept: string;
  label: string;
  days: number;
  base: number;
  amount: number;
  provisioned: number;
}

export interface EmployeeSettlement {
  employeeId: string;
  employeeName: string;
  documentNumber: string;
  lines: BenefitLine[];
  grossTotal: number;
  withholding: number;
  netPay: number;
  toSeveranceFund: number;
  notes: string[];
}

export interface SettleBenefitsPreview {
  type: BenefitSettlementType;
  periodStart: string;
  periodEnd: string;
  description: string;
  settlements: EmployeeSettlement[];
  skipped: Array<{ employeeName: string; reason: string }>;
}

export interface BenefitSettlementRecord {
  id: string;
  employeeId: string;
  type: BenefitSettlementType;
  periodStart: string;
  periodEnd: string;
  grossTotal: number;
  withholding: number;
  netPay: number;
  toSeveranceFund: number;
  detail: EmployeeSettlement;
  createdAt: string;
}

export function previewBenefitSettlement(input: SettleBenefitsInput): Promise<SettleBenefitsPreview> {
  return apiFetch("/benefit-settlements/preview", { method: "POST", body: input });
}

export function settleBenefits(input: SettleBenefitsInput): Promise<{ data: BenefitSettlementRecord[] }> {
  return apiFetch("/benefit-settlements", { method: "POST", body: input });
}

export function listBenefitSettlements(): Promise<{ data: BenefitSettlementRecord[] }> {
  return apiFetch("/benefit-settlements");
}

export async function downloadBenefitSettlementPdf(id: string, fileName: string): Promise<void> {
  const { accessToken } = useAuthStore.getState();
  const res = await fetch(`${BASE_URL}/benefit-settlements/${id}/pdf`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) throw new Error("No se pudo descargar el documento");
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ---- Bonificaciones no salariales ----

export interface PayrollBonusRecord {
  id: string;
  employeeId: string;
  date: string;
  amount: number;
  description: string;
  status: "ACTIVE" | "CANCELLED";
  createdAt: string;
}

export function listPayrollBonuses(): Promise<{ data: PayrollBonusRecord[] }> {
  return apiFetch("/payroll-bonuses");
}

export function createPayrollBonus(input: { employeeId: string; date: string; amount: number; description: string }): Promise<PayrollBonusRecord> {
  return apiFetch("/payroll-bonuses", { method: "POST", body: input });
}

export function cancelPayrollBonus(id: string): Promise<PayrollBonusRecord> {
  return apiFetch(`/payroll-bonuses/${id}/cancel`, { method: "POST" });
}
