import { z } from "zod";

export const createEmployeeSchema = z.object({
  branchId: z.string().uuid(),
  documentType: z.string().min(1).default("CC"),
  documentNumber: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().optional(),
  secondLastName: z.string().optional(),
  workerType: z.string().optional(),
  workerSubtype: z.string().optional(),
  birthDate: z.coerce.date().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  position: z.string().min(1),
  contractType: z.enum(["FIXED_TERM", "INDEFINITE", "SERVICE", "LEARNING"]),
  baseSalary: z.number().nonnegative(),
  hireDate: z.coerce.date(),
  eps: z.string().optional(),
  arlRiskLevel: z.enum(["I", "II", "III", "IV", "V"]).optional(),
  pensionFund: z.string().optional(),
  compensationFund: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  middleName: z.string().optional(),
  secondLastName: z.string().optional(),
  workerType: z.string().optional(),
  workerSubtype: z.string().optional(),
  birthDate: z.coerce.date().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  position: z.string().min(1).optional(),
  contractType: z.enum(["FIXED_TERM", "INDEFINITE", "SERVICE", "LEARNING"]).optional(),
  baseSalary: z.number().nonnegative().optional(),
  eps: z.string().optional(),
  arlRiskLevel: z.enum(["I", "II", "III", "IV", "V"]).optional(),
  pensionFund: z.string().optional(),
  compensationFund: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
});
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

export const deactivateEmployeeSchema = z.object({
  terminationDate: z.coerce.date(),
});
export type DeactivateEmployeeInput = z.infer<typeof deactivateEmployeeSchema>;
