export interface DashboardMetrics {
  salesToday: {
    total: number;
    count: number;
  };
  salesMonth: {
    total: number;
    count: number;
  };
  estimatedProfitMonth: number;
  activeCashSession: {
    id: string;
    cashRegisterName: string;
    openedByUserName: string;
    openedAt: string;
    openingAmount: number;
  } | null;
  outOfStockCount: number;
  topProducts: Array<{ productId: string; name: string; quantitySold: number; total: number }>;
  pendingInvoices: number;
  newCustomersMonth: number;
}
