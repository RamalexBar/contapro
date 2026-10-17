// Genera el manual de uso en PDF: apps/web/public/manual-contapro.pdf (el menu "Ver manual" lo abre).
// Uso: pnpm --filter @erp/api exec tsx scripts/user-manual/build-user-manual.ts
import { createWriteStream } from "fs";
import { resolve } from "path";
import PDFDocument from "pdfkit";
import { CHECK_ACCOUNTING, FIRST_STEPS, MANUAL_INTRO, SECTIONS, type StepGroup } from "./content";

const OUT = resolve(__dirname, "../../../web/public/manual-contapro.pdf");
const NAVY = "#1e3a8a";
const ORANGE = "#f97316";
const TEXT = "#1f2937";
const MUTED = "#64748b";
const M = 56;
const TOC_PAGES = 1;

const doc = new PDFDocument({ size: "A4", margin: M, bufferPages: true, info: { Title: "Manual de uso de ContaPro", Author: "ContaPro" } });
doc.pipe(createWriteStream(OUT));
const W = doc.page.width - M * 2;
const bottom = () => doc.page.height - M - 20;

// Las fuentes estandar de PDF no tienen la flecha: se usa el angulo simple.
const clean = (s: string) => s.replace(/→/g, "›").replace(/Contapro/g, "ContaPro");

function ensure(height: number) {
  if (doc.y + height > bottom()) doc.addPage();
}

// ------------------------------------------------------------------ portada
doc.rect(0, 0, doc.page.width, doc.page.height).fill(NAVY);
doc.roundedRect(M, 250, 64, 64, 14).fill("#ffffff");
[[M + 16, 286, 9, 18, "#8fa3c7"], [M + 29, 276, 9, 28, "#44619e"], [M + 42, 266, 9, 38, ORANGE]].forEach(([x, y, w, h, c]) =>
  doc.roundedRect(x as number, y as number, w as number, h as number, 2).fill(c as string)
);
doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(40).text("Conta", M + 84, 258, { continued: true }).font("Helvetica").fillColor("#fdba74").text("Pro");
doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(30).text("Manual de uso", M, 380);
doc.font("Helvetica").fontSize(14).fillColor("#c7d2fe").text("Cómo funciona cada opción del menú, paso a paso", M, 420);
doc.fontSize(11).text("Versión octubre de 2026  ·  contapro.com.co", M, doc.page.height - M - 30);

// ------------------------------------------------------------------ indice (se llena al final)
for (let i = 0; i < TOC_PAGES; i++) doc.addPage();
const toc: { label: string; page: number; level: number }[] = [];

function chapterTitle(group: string | null, title: string) {
  doc.addPage();
  toc.push({ label: group ? `${group} › ${title}` : title, page: doc.bufferedPageRange().count, level: group ? 1 : 0 });
  if (group) doc.font("Helvetica-Bold").fontSize(10).fillColor(ORANGE).text(group.toUpperCase(), { characterSpacing: 1.5 });
  doc.font("Helvetica-Bold").fontSize(22).fillColor(NAVY).text(title);
  doc.moveTo(M, doc.y + 4).lineTo(M + 60, doc.y + 4).lineWidth(3).strokeColor(ORANGE).stroke();
  doc.moveDown(1);
}

function paragraph(text: string, opts: { color?: string; size?: number } = {}) {
  doc.font("Helvetica").fontSize(opts.size ?? 11).fillColor(opts.color ?? TEXT);
  ensure(doc.heightOfString(clean(text), { width: W }) + 6);
  doc.text(clean(text), M, doc.y, { width: W, lineGap: 2 });
  doc.moveDown(0.6);
}

function stepGroup(group: StepGroup) {
  doc.font("Helvetica-Bold").fontSize(13);
  ensure(40);
  doc.fillColor(NAVY).text(clean(group.title), M, doc.y, { width: W });
  doc.moveDown(0.3);
  group.steps.forEach((step, i) => {
    const text = clean(step);
    doc.font("Helvetica").fontSize(11);
    const h = doc.heightOfString(text, { width: W - 28, lineGap: 2 });
    ensure(h + 6);
    const y = doc.y;
    doc.circle(M + 9, y + 7, 9).fill(group.steps.length > 1 ? NAVY : MUTED);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#ffffff").text(String(i + 1), M, y + 3, { width: 18, align: "center" });
    doc.font("Helvetica").fontSize(11).fillColor(TEXT).text(text, M + 28, y, { width: W - 28, lineGap: 2 });
    doc.moveDown(0.45);
  });
  doc.moveDown(0.5);
}

function box(title: string, lines: string[], fill: string, accent: string) {
  const items = lines.map(clean);
  doc.font("Helvetica").fontSize(10.5);
  const textH = items.reduce((s, l) => s + doc.heightOfString(l, { width: W - 36, lineGap: 2 }) + 5, 0);
  const h = textH + 34;
  ensure(h + 8);
  const y = doc.y;
  doc.roundedRect(M, y, W, h, 8).fill(fill);
  doc.rect(M, y, 4, h).fill(accent);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(accent).text(title, M + 16, y + 10);
  let cy = y + 28;
  for (const l of items) {
    doc.font("Helvetica").fontSize(10.5).fillColor(TEXT).text(`•  ${l}`, M + 16, cy, { width: W - 36, lineGap: 2 });
    cy = doc.y + 5;
  }
  doc.y = y + h + 12;
  doc.x = M;
}

// ------------------------------------------------------------------ contenido
chapterTitle(null, "Cómo usar este manual");
MANUAL_INTRO.forEach((p) => paragraph(p));
doc.moveDown(0.5);
FIRST_STEPS.forEach(stepGroup);

for (const section of SECTIONS) {
  chapterTitle(section.group, section.title);
  paragraph(section.intro, { size: 12 });
  section.how.forEach(stepGroup);
  if (section.accounting?.length) box("Qué queda en contabilidad", section.accounting, "#eff6ff", NAVY);
  if (section.tips?.length) box("Consejos", section.tips, "#fff7ed", "#c2410c");
}

chapterTitle(null, "Cómo revisar que todo quedó bien contabilizado");
paragraph(CHECK_ACCOUNTING.intro);
// Tabla: operacion / comprobante / cuentas.
const cols = [0.27, 0.28, 0.45].map((f) => f * W);
const row = (cells: string[], bold: boolean, fill?: string) => {
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9.5);
  const h = Math.max(...cells.map((c, i) => doc.heightOfString(clean(c), { width: cols[i]! - 10 }))) + 10;
  ensure(h);
  const y = doc.y;
  if (fill) doc.rect(M, y, W, h).fill(fill);
  let x = M;
  cells.forEach((c, i) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9.5).fillColor(bold ? "#ffffff" : TEXT).text(clean(c), x + 5, y + 5, { width: cols[i]! - 10 });
    x += cols[i]!;
  });
  doc.moveTo(M, y + h).lineTo(M + W, y + h).lineWidth(0.5).strokeColor("#cbd5e1").stroke();
  doc.y = y + h;
  doc.x = M;
};
row(["Operación", "Comprobante que se genera", "Cuentas que mueve"], true, NAVY);
CHECK_ACCOUNTING.table.forEach((r, i) => row(r, false, i % 2 ? "#f8fafc" : undefined));
doc.moveDown(1.2);
stepGroup({ title: "Paso a paso para revisar", steps: CHECK_ACCOUNTING.steps });

// ------------------------------------------------------------------ indice
doc.switchToPage(1);
doc.x = M;
doc.y = M;
doc.font("Helvetica-Bold").fontSize(22).fillColor(NAVY).text("Contenido");
doc.moveDown(0.8);
let tocPage = 1;
for (const entry of toc) {
  if (doc.y > bottom() - 10) {
    tocPage++;
    doc.switchToPage(tocPage);
    doc.x = M;
    doc.y = M;
  }
  const y = doc.y;
  const indent = entry.level ? 14 : 0;
  doc.font(entry.level ? "Helvetica" : "Helvetica-Bold").fontSize(entry.level ? 10.5 : 11.5).fillColor(entry.level ? TEXT : NAVY);
  doc.text(entry.label, M + indent, y, { width: W - 50 - indent, lineBreak: false });
  doc.text(String(entry.page), M + W - 40, y, { width: 40, align: "right" });
  doc.y = y + (entry.level ? 17 : 22);
}

// ------------------------------------------------------------------ pie de pagina
const range = doc.bufferedPageRange();
for (let i = 1; i < range.count; i++) {
  doc.switchToPage(i);
  // Escribir debajo del margen inferior crearia paginas nuevas: se quita el margen solo para el pie.
  doc.page.margins.bottom = 0;
  doc.font("Helvetica").fontSize(8.5).fillColor(MUTED);
  doc.text(`ContaPro · Manual de uso · contapro.com.co`, M, doc.page.height - M + 14, { width: W / 2, lineBreak: false });
  doc.text(`Página ${i + 1} de ${range.count}`, M + W / 2, doc.page.height - M + 14, { width: W / 2, align: "right", lineBreak: false });
}

doc.end();
console.log(`Manual generado: ${OUT} (${range.count} paginas)`);
