export interface OpportunityItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
}

export interface OpportunityItemRecord extends OpportunityItemInput {
  id: string;
  total: number;
}

export interface CreateOpportunityData {
  branchId: string;
  customerId: string;
  ownerUserId: string;
  title: string;
  description?: string;
  expectedCloseDate?: Date;
  items: OpportunityItemInput[];
}

export interface OpportunityRecord {
  id: string;
  branchId: string;
  customerId: string;
  ownerUserId: string;
  title: string;
  description: string | null;
  stage: string;
  expectedValue: number;
  expectedCloseDate: Date | null;
  lostReason: string | null;
  wonAt: Date | null;
  lostAt: Date | null;
  saleId: string | null;
  items: OpportunityItemRecord[];
  createdAt: Date;
}

export interface OpportunityListFilter {
  stage?: string;
  customerId?: string;
}

export interface UpdateOpportunityStageData {
  stage: string;
  lostReason?: string;
  wonAt?: Date;
  lostAt?: Date;
  saleId?: string;
}

export interface IOpportunityRepository {
  create(data: CreateOpportunityData): Promise<OpportunityRecord>;
  list(filter?: OpportunityListFilter): Promise<OpportunityRecord[]>;
  findByIdOrThrow(id: string): Promise<OpportunityRecord>;
  /** Usado tanto por UpdateStageUseCase (mover entre etapas abiertas / marcar perdida) como por
   * CloseOpportunityAsWonUseCase (marcar GANADA + enlazar saleId). */
  updateStage(id: string, data: UpdateOpportunityStageData): Promise<OpportunityRecord>;
}
