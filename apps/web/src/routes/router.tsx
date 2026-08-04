import { createBrowserRouter, Navigate } from "react-router-dom";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { RegisterPage } from "../features/auth/pages/RegisterPage";
import { DashboardPage } from "../features/dashboard/pages/DashboardPage";
import { ProductListPage } from "../features/inventory/pages/ProductListPage";
import { POSPage } from "../features/pos/pages/POSPage";
import { CashSessionPage } from "../features/cash/pages/CashSessionPage";
import { EmployeeListPage } from "../features/employees/pages/EmployeeListPage";
import { PayrollPage } from "../features/payroll/pages/PayrollPage";
import { TimeTrackingPage } from "../features/timetracking/pages/TimeTrackingPage";
import { TimeOffPage } from "../features/time-off/pages/TimeOffPage";
import { RbacPage } from "../features/rbac/pages/RbacPage";
import { CustomerListPage } from "../features/customers/pages/CustomerListPage";
import { AuditLogPage } from "../features/audit/pages/AuditLogPage";
import { QuotesAndNotesPage } from "../features/pos/pages/QuotesAndNotesPage";
import { AccountingPage } from "../features/accounting/pages/AccountingPage";
import { BankingPage } from "../features/accounting/pages/BankingPage";
import { SuppliersPage } from "../features/suppliers/pages/SuppliersPage";
import { PurchaseOrdersPage } from "../features/suppliers/pages/PurchaseOrdersPage";
import { BillingPage } from "../features/billing/pages/BillingPage";
import { PlatformAdminLoginPage } from "../features/platform-admin/pages/PlatformAdminLoginPage";
import { PlatformDashboardPage } from "../features/platform-admin/pages/PlatformDashboardPage";
import { PlansPage } from "../features/platform-admin/pages/PlansPage";
import { SubscriptionsPage } from "../features/platform-admin/pages/SubscriptionsPage";
import { CompaniesPage } from "../features/platform-admin/pages/CompaniesPage";
import { PlatformProtectedRoute } from "../features/platform-admin/routes/PlatformProtectedRoute";
import { ProtectedRoute } from "./ProtectedRoute";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/dashboard" replace /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/products",
    element: (
      <ProtectedRoute>
        <ProductListPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/pos",
    element: (
      <ProtectedRoute>
        <POSPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/cash",
    element: (
      <ProtectedRoute>
        <CashSessionPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/employees",
    element: (
      <ProtectedRoute>
        <EmployeeListPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/payroll",
    element: (
      <ProtectedRoute>
        <PayrollPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/timetracking",
    element: (
      <ProtectedRoute>
        <TimeTrackingPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/time-off",
    element: (
      <ProtectedRoute>
        <TimeOffPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/rbac",
    element: (
      <ProtectedRoute>
        <RbacPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/customers",
    element: (
      <ProtectedRoute>
        <CustomerListPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/audit",
    element: (
      <ProtectedRoute>
        <AuditLogPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/quotes-notes",
    element: (
      <ProtectedRoute>
        <QuotesAndNotesPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/accounting",
    element: (
      <ProtectedRoute>
        <AccountingPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/accounting/banks",
    element: (
      <ProtectedRoute>
        <BankingPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/suppliers",
    element: (
      <ProtectedRoute>
        <SuppliersPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/purchase-orders",
    element: (
      <ProtectedRoute>
        <PurchaseOrdersPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/billing",
    element: (
      <ProtectedRoute>
        <BillingPage />
      </ProtectedRoute>
    ),
  },
  { path: "/admin/login", element: <PlatformAdminLoginPage /> },
  {
    path: "/admin",
    element: (
      <PlatformProtectedRoute>
        <PlatformDashboardPage />
      </PlatformProtectedRoute>
    ),
  },
  {
    path: "/admin/plans",
    element: (
      <PlatformProtectedRoute>
        <PlansPage />
      </PlatformProtectedRoute>
    ),
  },
  {
    path: "/admin/subscriptions",
    element: (
      <PlatformProtectedRoute>
        <SubscriptionsPage />
      </PlatformProtectedRoute>
    ),
  },
  {
    path: "/admin/companies",
    element: (
      <PlatformProtectedRoute>
        <CompaniesPage />
      </PlatformProtectedRoute>
    ),
  },
]);
