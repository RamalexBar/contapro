export interface EmployeeRecord {
  id: string;
  companyId: string;
  branchId: string;
  userId: string | null;
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  position: string;
  contractType: string;
  baseSalary: number;
  hireDate: Date;
  terminationDate: Date | null;
  status: string;
  eps: string | null;
  arlRiskLevel: string | null;
  pensionFund: string | null;
  compensationFund: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
}

export interface CreateEmployeeData {
  branchId: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  birthDate?: Date;
  address?: string;
  phone?: string;
  email?: string;
  position: string;
  contractType: string;
  baseSalary: number;
  hireDate: Date;
  eps?: string;
  arlRiskLevel?: string;
  pensionFund?: string;
  compensationFund?: string;
  bankName?: string;
  bankAccountNumber?: string;
}

export interface UpdateEmployeeData {
  firstName?: string;
  lastName?: string;
  birthDate?: Date;
  address?: string;
  phone?: string;
  email?: string;
  position?: string;
  contractType?: string;
  baseSalary?: number;
  eps?: string;
  arlRiskLevel?: string;
  pensionFund?: string;
  compensationFund?: string;
  bankName?: string;
  bankAccountNumber?: string;
}

export interface IEmployeeRepository {
  create(data: CreateEmployeeData): Promise<EmployeeRecord>;
  findById(id: string): Promise<EmployeeRecord | null>;
  findByIdOrThrow(id: string): Promise<EmployeeRecord>;
  findByUserId(userId: string): Promise<EmployeeRecord | null>;
  list(filter?: { branchId?: string; status?: string }): Promise<EmployeeRecord[]>;
  update(id: string, data: UpdateEmployeeData): Promise<EmployeeRecord>;
  deactivate(id: string, terminationDate: Date): Promise<EmployeeRecord>;
  listActiveForPeriod(branchId: string | null, startDate: Date, endDate: Date): Promise<EmployeeRecord[]>;
}
