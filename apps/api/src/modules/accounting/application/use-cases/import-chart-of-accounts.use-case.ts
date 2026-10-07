import type { ImportChartOfAccountsInput, ImportChartOfAccountsResult } from "@erp/shared-types";
import {
  MAX_PRINCIPAL_ACCOUNT_LEVEL,
  type AccountRecord,
  type AccountType,
  type IChartOfAccountsRepository,
} from "../../domain/chart-of-accounts.repository";
import type { CreateAccountUseCase } from "./create-account.use-case";
import type { SetAccountActiveUseCase } from "./set-account-active.use-case";
import type { UpdateAccountUseCase } from "./update-account.use-case";

/** Fila 1 del Excel es el encabezado, asi que la primera cuenta es la fila 2. */
const FIRST_DATA_ROW = 2;

/** Naturaleza por clase, misma convencion que el PUC precargado (seed-chart-of-accounts.ts):
 * 5 gastos, 6 costos de ventas y 7 costos de produccion son todas EXPENSE en el modelo. */
const TYPE_BY_CLASS: Record<string, AccountType> = {
  "1": "ASSET",
  "2": "LIABILITY",
  "3": "EQUITY",
  "4": "INCOME",
  "5": "EXPENSE",
  "6": "EXPENSE",
  "7": "EXPENSE",
};

interface PlannedRow {
  rowNumber: number;
  code: string;
  name: string;
}

/**
 * Carga el plan de cuentas propio de la empresa (catalogo NIIF o PUC extendido exportado de otro
 * programa) sobre el PUC que Contapro ya precarga a cada empresa. NIIF no trae un catalogo oficial
 * en Colombia: casi todos parten de los codigos del PUC, asi que se trabaja por codigo:
 *
 * - Codigo que ya existe: se activa si estaba inactivo; si es subcuenta/auxiliar (nivel > 3) y el
 *   nombre cambia, se renombra. Las cuentas principales (clase/grupo/cuenta) conservan el nombre
 *   PUC -- son fijas (ver UpdateAccountUseCase) -- y se informa la diferencia.
 * - Codigo nuevo: se crea debajo de la cuenta padre que resulte del prefijo mas largo que exista
 *   en Contapro o en el mismo archivo (110505 va debajo de 1105). Se crea con CreateAccountUseCase,
 *   asi que el padre deja de admitir movimientos directos igual que al crear una subcuenta a mano.
 * - Clases 8 y 9 (cuentas de orden): se omiten con aviso, el modelo todavia no las maneja.
 * - Cuentas de Contapro que no estan en el archivo: no se tocan.
 *
 * Todo o nada a nivel de validacion (mismo criterio que ImportProductsUseCase): con un solo error
 * no se aplica nada. `dryRun` devuelve el plan (cuantas se crean/activan/renombran) sin aplicarlo.
 */
export class ImportChartOfAccountsUseCase {
  constructor(
    private readonly repo: IChartOfAccountsRepository,
    private readonly createAccount: CreateAccountUseCase,
    private readonly updateAccount: UpdateAccountUseCase,
    private readonly setAccountActive: SetAccountActiveUseCase
  ) {}

  async execute(input: ImportChartOfAccountsInput): Promise<ImportChartOfAccountsResult> {
    const result: ImportChartOfAccountsResult = {
      dryRun: input.dryRun,
      totalRows: input.rows.length,
      created: 0,
      activated: 0,
      renamed: 0,
      unchanged: 0,
      principalNamesKept: [],
      skipped: [],
      errors: [],
    };

    const existingByCode = new Map((await this.repo.list()).map((a) => [a.code, a]));
    const seenInFile = new Map<string, number>();
    const planned: PlannedRow[] = [];

    input.rows.forEach((raw, index) => {
      const rowNumber = input.rowNumbers?.[index] ?? index + FIRST_DATA_ROW;
      const code = normalizeCode(raw.code);
      const name = raw.name.trim().replace(/\s+/g, " ");
      const messages: string[] = [];

      if (!code) messages.push("Falta el codigo de la cuenta");
      else if (!/^\d+$/.test(code)) messages.push(`Codigo invalido "${raw.code.trim()}": solo puede tener numeros`);
      if (!name) messages.push("Falta el nombre de la cuenta");

      if (code && /^\d+$/.test(code)) {
        const firstRow = seenInFile.get(code);
        if (firstRow !== undefined) messages.push(`El codigo ${code} esta repetido (fila ${firstRow})`);
        else seenInFile.set(code, rowNumber);
      }

      if (messages.length > 0) {
        result.errors.push({ rowNumber, messages });
        return;
      }
      if (code.startsWith("8") || code.startsWith("9")) {
        result.skipped.push({ rowNumber, code, reason: "Cuenta de orden (clases 8 y 9): Contapro todavia no las maneja" });
        return;
      }
      if (!TYPE_BY_CLASS[code.charAt(0)]) {
        result.errors.push({ rowNumber, messages: [`El codigo ${code} no empieza por una clase valida (1 a 9)`] });
        return;
      }
      planned.push({ rowNumber, code, name });
    });

    // Padres primero: una cuenta nueva puede colgar de otra nueva del mismo archivo.
    planned.sort((a, b) => a.code.length - b.code.length || a.code.localeCompare(b.code));
    const availableCodes = new Set([...existingByCode.keys(), ...planned.map((p) => p.code)]);

    const toActivate: AccountRecord[] = [];
    const toRename: { account: AccountRecord; row: PlannedRow }[] = [];
    const toCreate: { row: PlannedRow; parentCode: string | null }[] = [];

    for (const row of planned) {
      const existing = existingByCode.get(row.code);
      if (existing) {
        const sameName = normalizeName(existing.name) === normalizeName(row.name);
        if (!existing.isActive) toActivate.push(existing);
        if (!sameName && existing.level > MAX_PRINCIPAL_ACCOUNT_LEVEL) toRename.push({ account: existing, row });
        if (!sameName && existing.level <= MAX_PRINCIPAL_ACCOUNT_LEVEL) {
          result.principalNamesKept.push({ code: row.code, fileName: row.name, currentName: existing.name });
        }
        // Una principal activa con otro nombre tambien queda igual (el nombre PUC no se toca).
        const willRename = !sameName && existing.level > MAX_PRINCIPAL_ACCOUNT_LEVEL;
        if (existing.isActive && !willRename) result.unchanged += 1;
        continue;
      }

      const parentCode = findParentCode(row.code, availableCodes);
      if (row.code.length > 1 && parentCode === null) {
        result.errors.push({
          rowNumber: row.rowNumber,
          messages: [`No se encontro la cuenta padre de ${row.code}: agrega su clase o grupo al archivo`],
        });
        continue;
      }
      toCreate.push({ row, parentCode });
    }

    result.errors.sort((a, b) => a.rowNumber - b.rowNumber);
    result.created = toCreate.length;
    result.activated = toActivate.length;
    result.renamed = toRename.length;
    if (input.dryRun || result.errors.length > 0) return result;

    const failures: { rowNumber: number; messages: string[] }[] = [];
    const attempt = async (rowNumber: number, fn: () => Promise<unknown>) => {
      try {
        await fn();
        return true;
      } catch (err) {
        failures.push({ rowNumber, messages: [err instanceof Error ? err.message : "No se pudo guardar la cuenta"] });
        return false;
      }
    };

    for (const account of toActivate) {
      const row = planned.find((p) => p.code === account.code)!;
      if (!(await attempt(row.rowNumber, () => this.setAccountActive.execute(account.id, true)))) result.activated -= 1;
    }
    for (const { account, row } of toRename) {
      if (!(await attempt(row.rowNumber, () => this.updateAccount.execute(account.id, { name: row.name })))) result.renamed -= 1;
    }

    const idByCode = new Map([...existingByCode.values()].map((a) => [a.code, a.id]));
    for (const { row, parentCode } of toCreate) {
      const parentId = parentCode ? idByCode.get(parentCode) : undefined;
      if (parentCode && !parentId) {
        // El padre era una cuenta nueva del archivo que fallo al crearse.
        failures.push({ rowNumber: row.rowNumber, messages: [`No se pudo crear porque fallo su cuenta padre ${parentCode}`] });
        result.created -= 1;
        continue;
      }
      const ok = await attempt(row.rowNumber, async () => {
        const account = await this.createAccount.execute({
          code: row.code,
          name: row.name,
          type: TYPE_BY_CLASS[row.code.charAt(0)]!,
          parentId,
          acceptsEntries: true,
        });
        idByCode.set(account.code, account.id);
      });
      if (!ok) result.created -= 1;
    }

    result.errors = failures.sort((a, b) => a.rowNumber - b.rowNumber);
    return result;
  }
}

/** "1105.05", "11 05 05" y "11-05-05" son el mismo codigo 110505. */
function normalizeCode(code: string): string {
  return code.trim().replace(/[\s.\-]/g, "");
}

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function findParentCode(code: string, available: Set<string>): string | null {
  for (let length = code.length - 1; length >= 1; length--) {
    const prefix = code.slice(0, length);
    if (available.has(prefix)) return prefix;
  }
  return null;
}
