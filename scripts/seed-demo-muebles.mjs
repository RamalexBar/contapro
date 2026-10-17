// Crea una empresa de demostracion de muebles usando la API publica de Contapro, igual que un
// usuario real: registro, categorias, productos, proveedores, compras con entrada a inventario,
// clientes, apertura de caja y ventas (efectivo, tarjeta, transferencia, mixta y credito con
// retencion). Sirve para demostraciones comerciales.
//
// Uso (las credenciales van por variables de entorno, nunca en este archivo):
//   DEMO_API=https://api.contapro.com.co/api DEMO_EMAIL=... DEMO_PASSWORD=... node scripts/seed-demo-muebles.mjs
// Opcional: DEMO_NIT (por defecto uno ficticio que empieza por 999), DEMO_COMPANY.

const API = process.env.DEMO_API ?? "http://localhost:4000/api";
const EMAIL = process.env.DEMO_EMAIL;
const PASSWORD = process.env.DEMO_PASSWORD;
const NIT = process.env.DEMO_NIT ?? `999${String(Date.now()).slice(-6)}`;
const COMPANY = process.env.DEMO_COMPANY ?? "Muebles El Roble";
if (!EMAIL || !PASSWORD) {
  console.error("Faltan DEMO_EMAIL y DEMO_PASSWORD");
  process.exit(1);
}

const round2 = (n) => Math.round(n * 100) / 100;

async function call(method, path, token, body) {
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  const json = text ? JSON.parse(text) : null;
  return json && typeof json === "object" && "data" in json && !Array.isArray(json) && Object.keys(json).length === 1 ? json.data : json;
}
const list = (r) => (Array.isArray(r) ? r : (r?.data ?? []));

// Mismos redondeos que create-sale.use-case.ts, para pagar el neto exacto.
function saleTotals(lines, withholdingRate = 0, withholdingBase = 0) {
  let total = 0;
  let base = 0;
  for (const l of lines) {
    const lineSubtotal = round2(l.price * l.quantity);
    const discount = round2(lineSubtotal - round2(lineSubtotal * (1 - (l.discount ?? 0) / 100)));
    const taxable = lineSubtotal - discount;
    const tax = round2(taxable * (l.taxRate / 100));
    base = round2(base + taxable);
    total = round2(total + round2(taxable + tax));
  }
  const retention = round2(withholdingBase * (withholdingRate / 100));
  return { total, base, net: round2(total - retention) };
}

async function main() {
  console.log(`Registrando "${COMPANY}" (NIT ${NIT}) en ${API}`);
  const { companyId } = await call("POST", "/auth/register-company", null, {
    companyName: COMPANY,
    legalName: `${COMPANY} S.A.S.`,
    nit: NIT,
    companyEmail: EMAIL,
    branchName: "Almacén Pereira",
    adminFullName: "Administrador Demo",
    adminEmail: EMAIL,
    adminPassword: PASSWORD,
  });
  const { accessToken: token } = await call("POST", "/auth/login", null, { email: EMAIL, password: PASSWORD, companyId });
  const branchId = list(await call("GET", "/auth/branches", token))[0].id;

  // Categorias y productos (sin stock: el stock entra con las compras).
  const categories = {};
  for (const name of ["Salas", "Comedores", "Alcobas", "Oficina"]) {
    categories[name] = (await call("POST", "/categories", token, { name })).id;
  }
  const catalog = [
    { sku: "SAL-001", name: "Sofá 3 puestos tela gris", category: "Salas", cost: 950000, price: 1690000 },
    { sku: "SAL-002", name: "Sofá cama 2 puestos", category: "Salas", cost: 780000, price: 1390000 },
    { sku: "SAL-003", name: "Mesa de centro madera", category: "Salas", cost: 210000, price: 389000 },
    { sku: "COM-001", name: "Comedor 6 puestos roble", category: "Comedores", cost: 1450000, price: 2590000 },
    { sku: "COM-002", name: "Comedor 4 puestos", category: "Comedores", cost: 820000, price: 1490000 },
    { sku: "ALC-001", name: "Cama doble 140x190", category: "Alcobas", cost: 690000, price: 1190000 },
    { sku: "ALC-002", name: "Colchón doble resortado", category: "Alcobas", cost: 520000, price: 899000 },
    { sku: "ALC-003", name: "Nochero 2 cajones", category: "Alcobas", cost: 120000, price: 229000 },
    { sku: "OFI-001", name: "Escritorio en L", category: "Oficina", cost: 380000, price: 690000 },
    { sku: "OFI-002", name: "Silla ergonómica", category: "Oficina", cost: 240000, price: 449000 },
  ];
  const products = {};
  for (const p of catalog) {
    const created = await call("POST", "/products", token, {
      sku: p.sku, name: p.name, categoryId: categories[p.category], currentCost: p.cost, currentPrice: p.price, taxRate: 19, minStock: 2,
    });
    products[p.sku] = { id: created.id, ...p };
  }
  console.log(`${catalog.length} productos creados`);

  // Proveedores y compras: entran al inventario y se contabilizan.
  const suppliers = [
    { name: "Maderas y Diseños del Eje S.A.S.", nit: "999100201", municipalityCode: "66001",
      items: [["SAL-001", 4], ["SAL-002", 3], ["SAL-003", 6], ["COM-001", 2], ["COM-002", 3]] },
    { name: "Descanso Total Colchones Ltda.", nit: "999100202", municipalityCode: "05001",
      items: [["ALC-001", 4], ["ALC-002", 6], ["ALC-003", 8], ["OFI-001", 5], ["OFI-002", 10]] },
  ];
  let invoice = 1001;
  for (const s of suppliers) {
    const supplier = await call("POST", "/suppliers", token, {
      name: s.name, nit: s.nit, documentType: "NIT", municipalityCode: s.municipalityCode, isObligatedToInvoice: true,
      email: `ventas${invoice}@ejemplo.com`, phone: "3000000000",
    });
    const items = s.items.map(([sku, quantity]) => ({ productId: products[sku].id, quantity, unitCost: products[sku].cost }));
    const subtotal = round2(items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0));
    const taxTotal = round2(subtotal * 0.19);
    await call("POST", "/purchases", token, {
      branchId, supplierId: supplier.id, invoiceNumber: `FV-${invoice++}`, subtotal, taxTotal, total: round2(subtotal + taxTotal),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString(), items,
    });
  }
  console.log("2 compras registradas con entrada a inventario");

  // Clientes.
  const laura = await call("POST", "/customers", token, {
    documentType: "CC", documentNumber: "1088300111", name: "Laura Gómez Restrepo", email: "laura.gomez@ejemplo.com",
    phone: "3101234567", address: "Cra 7 # 20-15", municipalityCode: "66001",
  });
  const carlos = await call("POST", "/customers", token, {
    documentType: "CC", documentNumber: "10125678", name: "Carlos Ramírez Ospina", email: "carlos.ramirez@ejemplo.com",
    phone: "3159876543", address: "Calle 14 # 9-30", municipalityCode: "66170",
  });
  const hotel = await call("POST", "/customers", token, {
    documentType: "NIT", documentNumber: "999200301", name: "Hotel Campestre La Ceiba S.A.S.", email: "compras@laceiba.ejemplo.com",
    phone: "6063334455", address: "Km 5 vía Armenia", municipalityCode: "66001", creditLimit: 20000000,
    dianTaxRegimeId: "01", dianTaxLevelId: "O-23",
  });

  // Caja abierta, como en el almacen.
  const register = list(await call("GET", "/cash/registers", token))[0];
  const session = await call("POST", "/cash/sessions/open", token, { cashRegisterId: register.id, openingAmount: 300000 });
  const cashSessionId = session.id;

  const concepts = list(await call("GET", "/withholding-concepts", token));
  const retefuente = concepts.find((c) => c.type === "RETEFUENTE" && /compra/i.test(c.name)) ?? concepts.find((c) => c.type === "RETEFUENTE");

  const line = (sku, quantity, discount = 0) => ({ sku, quantity, discount, price: products[sku].price, taxRate: 19 });
  const sales = [
    { label: "Efectivo, consumidor final", lines: [line("ALC-003", 2), line("SAL-003", 1)], pay: (n) => [{ method: "CASH", amount: n }] },
    { label: "Tarjeta, Laura Gómez", customerId: laura.id, lines: [line("SAL-001", 1)], pay: (n) => [{ method: "CARD", amount: n }] },
    { label: "Transferencia con 5% de descuento, Carlos Ramírez", customerId: carlos.id, lines: [line("ALC-001", 1, 5), line("ALC-002", 1, 5)], pay: (n) => [{ method: "TRANSFER", amount: n }] },
    { label: "Mixta efectivo + transferencia", lines: [line("OFI-001", 1), line("OFI-002", 1)], pay: (n) => [{ method: "CASH", amount: 500000 }, { method: "TRANSFER", amount: round2(n - 500000) }] },
    { label: "Crédito 30 días con retención, Hotel La Ceiba", customerId: hotel.id, lines: [line("COM-001", 1), line("OFI-002", 4)], credit: true },
  ];
  for (const s of sales) {
    const withRetention = s.credit && retefuente;
    const base = saleTotals(s.lines).base;
    const totals = saleTotals(s.lines, withRetention ? Number(retefuente.ratePercent) : 0, withRetention ? base : 0);
    const sale = await call("POST", "/sales", token, {
      branchId, cashSessionId, customerId: s.customerId,
      items: s.lines.map((l) => ({ productId: products[l.sku].id, quantity: l.quantity, discountPercent: l.discount })),
      withholdings: withRetention ? [{ withholdingConceptId: retefuente.id, base }] : [],
      payments: s.credit ? [{ method: "CREDIT", amount: totals.net }] : s.pay(totals.net),
      ...(s.credit ? { dueDate: new Date(Date.now() + 30 * 86400000).toISOString() } : {}),
    });
    console.log(`Venta #${sale.number ?? "?"} ${s.label}: total ${totals.total}${withRetention ? `, neto ${totals.net} (retención ${retefuente.name})` : ""}`);
  }

  console.log(`\nListo. Ingresa en contapro.com.co con el correo ${EMAIL} (empresa ${COMPANY}). La caja queda abierta.`);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
