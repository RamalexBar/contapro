import { createBrowserRouter, Navigate } from "react-router-dom";
import { LoginPage } from "../features/auth/pages/LoginPage";
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
import { ProtectedRoute } from "./ProtectedRoute";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/dashboard" replace /> },
  { path: "/login", element: <LoginPage /> },
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
]);
