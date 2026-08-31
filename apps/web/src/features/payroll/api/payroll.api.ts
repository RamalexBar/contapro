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
