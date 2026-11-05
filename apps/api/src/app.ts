import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { apiRateLimiter } from "./shared/middlewares/rate-limit.middleware";
import { errorHandlerMiddleware } from "./shared/middlewares/error-handler.middleware";

import { authRouter } from "./modules/auth/interfaces/auth.routes";
import { rbacRouter } from "./modules/rbac/interfaces/rbac.routes";
import { branchesRouter } from "./modules/branches/interfaces/branches.routes";
import { categoryRouter } from "./modules/inventory/category/interfaces/category.routes";
import { brandRouter } from "./modules/inventory/brand/interfaces/brand.routes";
import { productPhotoPublicRouter, productRouter } from "./modules/inventory/product/interfaces/product.routes";
import { priceListRouter } from "./modules/inventory/price-list/interfaces/price-list.routes";
import { stockRouter } from "./modules/inventory/stock/interfaces/stock.routes";
import { saleRouter } from "./modules/pos/sale/interfaces/sale.routes";
import { quoteRouter } from "./modules/pos/quote/interfaces/quote.routes";
import { creditNoteRouter } from "./modules/pos/credit-note/interfaces/credit-note.routes";
import { debitNoteRouter } from "./modules/pos/debit-note/interfaces/debit-note.routes";
import { returnRouter } from "./modules/pos/return/interfaces/return.routes";
import { cashSessionRouter } from "./modules/cash/cash-session/interfaces/cash-session.routes";
import { auditRouter } from "./modules/audit/interfaces/audit.routes";
import { dashboardRouter } from "./modules/dashboard/interfaces/dashboard.routes";
import { customerRouter } from "./modules/customers/interfaces/customer.routes";

import { employeesRouter } from "./modules/employees/interfaces/employees.routes";
import { timetrackingRouter } from "./modules/timetracking/interfaces/timetracking.routes";
import { payrollRouter } from "./modules/payroll/interfaces/payroll.routes";
import { accountingRouter } from "./modules/accounting/interfaces/accounting.routes";
import { suppliersRouter } from "./modules/suppliers/interfaces/suppliers.routes";
import { expensesRouter } from "./modules/expenses/interfaces/expenses.routes";
import { electronicInvoicingRouter } from "./modules/electronic-invoicing/interfaces/electronic-invoicing.routes";
import { companyRouter } from "./modules/company/interfaces/company.routes";
import { manualInvoicingRouter } from "./modules/manual-invoicing/interfaces/manual-invoicing.routes";
import { syncRouter } from "./modules/sync/interfaces/sync.routes";
import { billingRouter } from "./modules/billing/interfaces/billing.routes";
import { collectionsRouter } from "./modules/collections/interfaces/collections.routes";
import { contactRouter } from "./modules/contact/interfaces/contact.routes";
import { collectionsWebhookRouter } from "./modules/collections/interfaces/collections-webhook.routes";
import { opportunityRouter } from "./modules/crm/opportunity/interfaces/opportunity.routes";
import { recurringInvoiceRouter } from "./modules/recurring-invoices/interfaces/recurring-invoice.routes";
import { exogenaRouter } from "./modules/exogena/interfaces/exogena.routes";
import { commissionsRouter } from "./modules/commissions/interfaces/commissions.routes";
import { fixedAssetsRouter } from "./modules/fixed-assets/interfaces/fixed-assets.routes";
import { apiKeyRouter } from "./modules/public-api/interfaces/api-key.routes";
import { publicApiRouter } from "./modules/public-api/interfaces/public-api.routes";
import { webhooksRouter } from "./modules/webhooks/interfaces/webhooks.routes";
import { partnerApiRouter } from "./modules/partner-api/interfaces/partner-api.routes";

import { saasAdminRouter } from "./modules/saas-admin/interfaces/saas-admin.routes";

export const app = express();

// Delante de la API hay dos intermediarios: Cloudflare (contapro.com.co) y el balanceador de Render (red 10.x). Sin
// esto req.ip era la de uno de ellos y TODOS los visitantes compartian los limites (20 intentos de login cada 15 min, 5
// mensajes de contacto por hora...). Se confia solo en esas direcciones: req.ip queda en el primer salto que no es
// ninguno de los dos (el visitante), y una cabecera X-Forwarded-For inventada no sirve para hacerse pasar por otro.
// Rangos publicados por Cloudflare en https://www.cloudflare.com/ips/ (revisar si algun dia cambian).
const CLOUDFLARE_RANGES = [
  "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18", "108.162.192.0/18",
  "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
  "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
  "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32",
];
app.set("trust proxy", ["loopback", "10.0.0.0/8", ...CLOUDFLARE_RANGES]);

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
// 30mb: el default (100kb) rechazaria de entrada la foto/PDF en base64 de POST /purchases/extract
// (lectura automatica de facturas, ver suppliers.container.ts) o los hasta 5 adjuntos de
// POST /admin/companies/:id/factus-activation-request (ver saas-admin.validators.ts) -- no hay
// parser JSON por ruta en este proyecto, un solo limite global cubre a los dos.
app.use(express.json({ limit: "30mb" }));
app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));
app.use("/api", apiRateLimiter);

app.get("/health", (_req, res) => res.json({ status: "ok", env: env.NODE_ENV }));

// ---- Modulos funcionales ----
app.use("/api", authRouter);
// saas-admin va ANTES de cualquier router tenant-scoped: cada router de abajo hace
// `.use(tenantContextMiddleware)` sin path, que intercepta CUALQUIER request que le llegue
// (no solo sus propias rutas) y devuelve 401 antes de que Express siga probando routers
// posteriores. Como /admin/* nunca es tenant-scoped (autenticacion de plataforma separada, ver
// shared/middlewares/require-platform-admin.middleware.ts), tiene que montarse antes de que un
// router tenant-scoped tenga la oportunidad de interceptarlo.
app.use("/api", saasAdminRouter);
// Formulario de contacto (publico) y su listado del panel: sin sesion de empresa, antes de los routers con sesion.
app.use("/api", contactRouter);
// Mismo motivo que saasAdminRouter arriba: el webhook de Wompi para cobranza (item 31) no lleva
// JWT/tenant context, tiene que montarse antes de que un router tenant-scoped lo intercepte.
app.use("/api", collectionsWebhookRouter);
// Mismo motivo: la API publica (item 40) se autentica por API key (apiKeyAuthMiddleware), no por
// JWT (tenantContextMiddleware) -- tiene que montarse antes de que un router tenant-scoped la
// intercepte.
app.use("/api", publicApiRouter);
// Mismo motivo: el alta de empresas desde Cajapro (combo) se autentica con la llave del aliado.
app.use("/api", partnerApiRouter);
// Fotos de productos: sin sesion (direccion firmada), antes de los routers que exigen sesion.
app.use("/api", productPhotoPublicRouter);
app.use("/api", rbacRouter);
app.use("/api", branchesRouter);
app.use("/api", categoryRouter);
app.use("/api", brandRouter);
app.use("/api", productRouter);
app.use("/api", priceListRouter);
app.use("/api", stockRouter);
app.use("/api", saleRouter);
app.use("/api", quoteRouter);
app.use("/api", creditNoteRouter);
app.use("/api", debitNoteRouter);
app.use("/api", returnRouter);
app.use("/api", cashSessionRouter);
app.use("/api", auditRouter);
app.use("/api", dashboardRouter);
app.use("/api", customerRouter);
app.use("/api", employeesRouter);
app.use("/api", timetrackingRouter);
app.use("/api", payrollRouter);
app.use("/api", accountingRouter);
app.use("/api", suppliersRouter);
app.use("/api", expensesRouter);
app.use("/api", electronicInvoicingRouter);
app.use("/api", companyRouter);
app.use("/api", manualInvoicingRouter);
app.use("/api", syncRouter);
app.use("/api", billingRouter);
app.use("/api", collectionsRouter);
app.use("/api", opportunityRouter);
app.use("/api", recurringInvoiceRouter);
app.use("/api", exogenaRouter);
app.use("/api", commissionsRouter);
app.use("/api", fixedAssetsRouter);
app.use("/api", apiKeyRouter);
app.use("/api", webhooksRouter);

app.use((req, res) => {
  res.status(404).json({ error: "NOT_FOUND", message: `Ruta no encontrada: ${req.method} ${req.path}` });
});

app.use(errorHandlerMiddleware);
