import type { CreatePayrollInput, CreatePayrollParameterInput } from "@erp/shared-types";
import { apiFetch } from "../../../lib/api-client";

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
