// Solo lectura: las empresas creadas desde el 20-oct-2026 (pruebas del combo Cajapro + Contapro), para
// decidir cuáles borrar. En Render → contapro-api → Shell:
//   node packages/database/scripts/listar-pruebas-combo.cjs
const { PrismaClient } = require("@prisma/client");

const p = new PrismaClient();

async function main() {
  const companies = await p.company.findMany({
    where: { createdAt: { gte: new Date(process.argv[2] ?? "2026-10-20") } },
    orderBy: { createdAt: "asc" },
  });
  for (const c of companies) {
    const sub = await p.subscription.findFirst({ where: { companyId: c.id }, orderBy: { createdAt: "desc" }, include: { plan: true } });
    const partner = await p.partnerAccount.findFirst({ where: { companyId: c.id } });
    const users = await p.user.findMany({ where: { companyId: c.id } });
    console.log("----");
    console.log(c.createdAt.toISOString().slice(0, 10), "|", c.id, "|", c.name, "| NIT", c.nit);
    console.log("  plan:", sub ? `${sub.plan.code} ${sub.status}` : "-", "| Cajapro:", partner ? partner.externalId : "-");
    console.log("  usuarios:", users.map((u) => u.email).join(", ") || "-");
  }
  console.log(`---- ${companies.length} empresa(s)`);
}

main().finally(() => p.$disconnect());
