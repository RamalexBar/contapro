export interface CreatePlanData {
  code: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  maxBranches: number;
  maxUsers: number;
  features: Record<string, unknown>;
}

export interface UpdatePlanData {
  name?: string;
  priceMonthly?: number;
  priceYearly?: number;
  maxBranches?: number;
  maxUsers?: number;
  features?: Record<string, unknown>;
  isActive?: boolean;
}

export interface PlanRecord {
  id: string;
  code: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  maxBranches: number;
  maxUsers: number;
  features: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
}

export interface IPlanRepository {
  create(data: CreatePlanData): Promise<PlanRecord>;
  list(): Promise<PlanRecord[]>;
  update(id: string, data: UpdatePlanData): Promise<PlanRecord>;
  findByIdOrThrow(id: string): Promise<PlanRecord>;
  /** Usado por RegisterCompanyUseCase para encontrar el plan de prueba al registrar una empresa. */
  findByCode(code: string): Promise<PlanRecord | null>;
}
