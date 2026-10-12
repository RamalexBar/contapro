export interface BranchRecord {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  isMain: boolean;
  isActive: boolean;
}

export interface CreateBranchData {
  name: string;
  code: string;
  address?: string;
  phone?: string;
}

export interface UpdateBranchData {
  name?: string;
  address?: string | null;
  phone?: string | null;
}

export interface IBranchRepository {
  /** Solo activas, salvo `includeInactive` (pantalla de administracion de sucursales). */
  list(companyId: string, options?: { includeInactive?: boolean }): Promise<BranchRecord[]>;
  findById(companyId: string, id: string): Promise<BranchRecord | null>;
  countActive(companyId: string): Promise<number>;
  existsByCode(companyId: string, code: string): Promise<boolean>;
  /** Crea la sucursal y su caja ("Caja <nombre>") en una sola transaccion: sin caja no se puede
   * abrir turno ni vender en ella. */
  create(companyId: string, data: CreateBranchData): Promise<BranchRecord>;
  update(companyId: string, id: string, data: UpdateBranchData): Promise<BranchRecord>;
  hasOpenCashSession(branchId: string): Promise<boolean>;
  /** Desactiva la sucursal y saca a sus usuarios: quien quede sin sucursal, o la tenia como
   * sucursal por defecto, pasa a la principal. Todo en una transaccion. */
  deactivate(companyId: string, id: string): Promise<BranchRecord>;
  reactivate(companyId: string, id: string): Promise<BranchRecord>;
}
