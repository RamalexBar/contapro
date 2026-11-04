import { basePrisma } from "@erp/database";
import { CompanyDeleteError, type CompanyAdminRecord, type ICompanyAdminRepository } from "../domain/company-admin.repository";

type Tx = Parameters<Parameters<typeof basePrisma.$transaction>[0]>[0];

interface ForeignKey {
  child: string;
  column: string;
  parent: string;
  parentColumn: string;
}

interface Target {
  pk: string | null;
  ids: Set<string>;
  byParent: { column: string; values: string[] }[];
}

/** Enlaces sin llave foranea en la base (la columna existe, la restriccion no): se recorren igual. */
const IMPLICIT_FKS: ForeignKey[] = [
  { child: "account_receivable_reminder_logs", column: "accountReceivableId", parent: "accounts_receivable", parentColumn: "id" },
  { child: "sync_conflict_logs", column: "outboxEventId", parent: "sync_outbox", parentColumn: "id" },
];

const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;

/**
 * Borrar una empresa con todo lo suyo. No hay una lista de tablas escrita a mano: se parte de TODAS las tablas con
 * columna `companyId` (la mayoria no tiene llave foranea hacia `companies`: el aislamiento es por columna) y desde
 * ahi se siguen las llaves foraneas hacia abajo (renglones de venta, pagos, lineas de comprobante...), asi sirve
 * para todos los modulos, tambien los que se agreguen. Seguro: si alguna fila marcada tiene `companyId` de OTRA
 * empresa, no se borra nada. Despues se borra de abajo hacia arriba, reintentando lo que todavia tenga hijos.
 * Mismo metodo que el borrado de negocios de Cajapro (apps/api/src/core/delete-business.ts alla).
 */
export class PrismaCompanyAdminRepository implements ICompanyAdminRepository {
  async findById(id: string): Promise<CompanyAdminRecord | null> {
    const c = await basePrisma.company.findUnique({ where: { id }, select: { id: true, name: true, isActive: true } });
    if (!c) return null;
    const partner = await basePrisma.partnerAccount.findFirst({ where: { companyId: id }, select: { partner: true } });
    return { ...c, partner: partner?.partner ?? null };
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    await basePrisma.company.update({ where: { id }, data: { isActive } });
  }

  async deleteCompletely(companyId: string): Promise<{ deleted: number }> {
    return basePrisma.$transaction(async (tx) => deleteCompanyIn(tx, companyId), { timeout: 120_000, maxWait: 10_000 });
  }
}

export async function deleteCompanyIn(tx: Tx, companyId: string): Promise<{ deleted: number }> {
  const dbFks = await tx.$queryRawUnsafe<ForeignKey[]>(`
    select c.conrelid::regclass::text as child, a.attname as "column", c.confrelid::regclass::text as parent, pa.attname as "parentColumn"
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    join pg_attribute pa on pa.attrelid = c.confrelid and pa.attnum = c.confkey[1]
    where c.contype = 'f' and array_length(c.conkey, 1) = 1 and c.connamespace = 'public'::regnamespace`);
  const pkRows = await tx.$queryRawUnsafe<{ table: string; column: string }[]>(`
    select i.indrelid::regclass::text as "table", a.attname as "column"
    from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
    join pg_class t on t.oid = i.indrelid
    where i.indisprimary and i.indnatts = 1 and t.relnamespace = 'public'::regnamespace`);
  const pks = new Map(pkRows.map((r) => [r.table.replace(/"/g, ""), r.column]));
  const fks = [...dbFks, ...IMPLICIT_FKS];
  const clean = (t: string) => t.replace(/"/g, "");

  const withCompany = new Set(
    (
      await tx.$queryRawUnsafe<{ table: string }[]>(
        `select c.table_name as "table" from information_schema.columns c join information_schema.tables t using (table_schema, table_name)
         where c.table_schema = 'public' and c.column_name = 'companyId' and t.table_type = 'BASE TABLE'`
      )
    ).map((r) => r.table)
  );

  // 1. Marcar: la empresa, todo lo que tiene su companyId, y lo que cuelga de eso
  const targets = new Map<string, Target>([["companies", { pk: "id", ids: new Set([companyId]), byParent: [] }]]);
  const queue: { table: string; column: string; values: string[] }[] = [{ table: "companies", column: "id", values: [companyId] }];
  for (const table of withCompany) {
    const pk = pks.get(table) ?? null;
    const t: Target = { pk, ids: new Set(), byParent: [] };
    targets.set(table, t);
    if (!pk) {
      t.byParent.push({ column: "companyId", values: [companyId] });
      continue;
    }
    const rows = await tx.$queryRawUnsafe<{ id: string }[]>(`select ${ident(pk)}::text as id from ${ident(table)} where "companyId" = $1`, companyId);
    rows.forEach((row) => t.ids.add(row.id));
    if (!rows.length) continue;
    for (const col of new Set(fks.filter((f) => clean(f.parent) === table).map((f) => f.parentColumn))) {
      const ids = rows.map((row) => row.id);
      const vals =
        col === pk
          ? ids
          : (
              await tx.$queryRawUnsafe<{ v: string }[]>(
                `select ${ident(col)}::text as v from ${ident(table)} where ${ident(pk)}::text = any($1::text[]) and ${ident(col)} is not null`,
                ids
              )
            ).map((r) => r.v);
      if (vals.length) queue.push({ table, column: col, values: vals });
    }
  }
  while (queue.length) {
    const { table, column, values } = queue.shift()!;
    for (const fk of fks.filter((f) => clean(f.parent) === table && f.parentColumn === column)) {
      const child = clean(fk.child);
      const pk = pks.get(child) ?? null;
      let t = targets.get(child);
      if (!t) targets.set(child, (t = { pk, ids: new Set(), byParent: [] }));
      if (!pk) {
        t.byParent.push({ column: fk.column, values });
        continue;
      }
      const rows = await tx.$queryRawUnsafe<{ id: string }[]>(
        `select ${ident(pk)}::text as id from ${ident(child)} where ${ident(fk.column)}::text = any($1::text[])`,
        values
      );
      const fresh = rows.map((r) => r.id).filter((id) => !t!.ids.has(id));
      fresh.forEach((id) => t!.ids.add(id));
      if (fresh.length) {
        for (const col of new Set(fks.filter((f) => clean(f.parent) === child).map((f) => f.parentColumn))) {
          const vals =
            col === pk
              ? fresh
              : (
                  await tx.$queryRawUnsafe<{ v: string }[]>(
                    `select ${ident(col)}::text as v from ${ident(child)} where ${ident(pk)}::text = any($1::text[]) and ${ident(col)} is not null`,
                    fresh
                  )
                ).map((r) => r.v);
          if (vals.length) queue.push({ table: child, column: col, values: vals });
        }
      }
    }
  }

  // 2. Seguro: nada de otra empresa
  for (const [table, t] of targets) {
    if (!t.pk || !t.ids.size || !withCompany.has(table)) continue;
    const [other] = await tx.$queryRawUnsafe<{ n: number }[]>(
      `select count(*)::int as n from ${ident(table)} where ${ident(t.pk)}::text = any($1::text[]) and "companyId" is distinct from $2`,
      [...t.ids],
      companyId
    );
    if (other!.n > 0) throw new CompanyDeleteError(`No se borro nada: ${other!.n} registro(s) de «${table}» pertenecen a otra empresa`);
  }

  // 3. Borrar de abajo hacia arriba, reintentando lo que todavia tenga hijos
  let pending = [...targets.keys()];
  let deleted = 0;
  for (let pass = 0; pending.length && pass < 50; pass++) {
    const blocked: string[] = [];
    for (const table of pending) {
      const t = targets.get(table)!;
      await tx.$executeRawUnsafe("savepoint borrar_empresa");
      try {
        for (const bp of t.byParent) {
          deleted += await tx.$executeRawUnsafe(`delete from ${ident(table)} where ${ident(bp.column)}::text = any($1::text[])`, bp.values);
        }
        if (t.pk && t.ids.size) {
          deleted += await tx.$executeRawUnsafe(`delete from ${ident(table)} where ${ident(t.pk)}::text = any($1::text[])`, [...t.ids]);
        }
        await tx.$executeRawUnsafe("release savepoint borrar_empresa");
      } catch (err) {
        await tx.$executeRawUnsafe("rollback to savepoint borrar_empresa");
        // Todavia tiene hijos: se reintenta en la siguiente pasada. 23503 = llave foranea normal; 23001 = llave
        // foranea RESTRICT (ej. users.companyId), que Postgres reporta con otro codigo.
        const code = String((err as { meta?: { code?: string } }).meta?.code ?? (err as Error).message);
        if (!code.includes("23503") && !code.includes("23001")) throw err;
        blocked.push(table);
      }
    }
    if (blocked.length === pending.length) throw new CompanyDeleteError(`No se pudo borrar: ${blocked.join(", ")} siguen con registros que dependen de ellos`);
    pending = blocked;
  }
  if (pending.length) throw new CompanyDeleteError(`No se pudo borrar: ${pending.join(", ")}`);
  return { deleted };
}
