import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { apiRateLimiter } from "./shared/middlewares/rate-limit.middleware";
import { errorHandlerMiddleware } from "./shared/middlewares/error-handler.middleware";

import { authRouter } from "./modules/auth/interfaces/auth.routes";
import { rbacRouter } from "./modules/rbac/interfaces/rbac.routes";
import { categoryRouter } from "./modules/inventory/category/interfaces/category.routes";
import { brandRouter } from "./modules/inventory/brand/interfaces/brand.routes";
import { productRouter } from "./modules/inventory/product/interfaces/product.routes";
import { stockRouter } from "./modules/inventory/stock/interfaces/stock.routes";
import { saleRouter } from "./modules/pos/sale/interfaces/sale.routes";
import { quoteRouter } from "./modules/pos/quote/interfaces/quote.routes";
import { creditNoteRouter } from "./modules/pos/credit-note/interfaces/credit-note.routes";
import { debitNoteRouter } from "./modules/pos/debit-note/interfaces/debit-note.routes";
import { cashSessionRouter } from "./modules/cash/cash-session/interfaces/cash-session.routes";
import { auditRouter } from "./modules/audit/interfaces/audit.routes";
import { dashboardRouter } from "./modules/dashboard/interfaces/dashboard.routes";
import { customerRouter } from "./modules/customers/interfaces/customer.routes";

import { suppliersRouter } from "./modules/suppliers/interfaces/suppliers.routes";
import { accountingRouter } from "./modules/accounting/interfaces/accounting.routes";
import { employeesRouter } from "./modules/employees/interfaces/employees.routes";
import { timetrackingRouter } from "./modules/timetracking/interfaces/timetracking.routes";
import { payrollRouter } from "./modules/payroll/interfaces/payroll.routes";
import { saasAdminRouter } from "./modules/saas-admin/interfaces/saas-admin.routes";
import { syncRouter } from "./modules/sync/interfaces/sync.routes";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));
app.use("/api", apiRateLimiter);

app.get("/health", (_req, res) => res.json({ status: "ok", env: env.NODE_ENV }));

// ---- Modulos funcionales ----
app.use("/api", authRouter);
app.use("/api", rbacRouter);
app.use("/api", categoryRouter);
app.use("/api", brandRouter);
app.use("/api", productRouter);
app.use("/api", stockRouter);
app.use("/api", saleRouter);
app.use("/api", quoteRouter);
app.use("/api", creditNoteRouter);
app.use("/api", debitNoteRouter);
app.use("/api", cashSessionRouter);
app.use("/api", auditRouter);
app.use("/api", dashboardRouter);
app.use("/api", customerRouter);

// ---- Modulos stub (501, ver docs/ALCANCE.md) ----
app.use("/api", suppliersRouter);
app.use("/api", accountingRouter);
app.use("/api", employeesRouter);
app.use("/api", timetrackingRouter);
app.use("/api", payrollRouter);
app.use("/api", saasAdminRouter);
app.use("/api", syncRouter);

app.use((req, res) => {
  res.status(404).json({ error: "NOT_FOUND", message: `Ruta no encontrada: ${req.method} ${req.path}` });
});

app.use(errorHandlerMiddleware);
