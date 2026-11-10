import { round2 } from "@erp/shared-utils";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { IJournalEntryRepository, JournalEntryRecord } from "../../domain/journal-entry.repository";
import type { PostInventoryJournalEntryUseCase } from "./post-inventory-journal-entry.use-case";

/** Valor real del inventario de la empresa (capas PEPS, todas las sucursales). Lo implementa el modulo de inventario. */
export interface IInventoryValueReader {
  totalValue(): Promise<number>;
}

export interface InventoryReconciliation {
  /** Saldo contable de la 1435 (y sus subcuentas), comprobantes POSTED. */
  ledgerBalance: number;
  /** Inventario valorizado real (Inventario -> Inventario valorizado). */
  inventoryValue: number;
  /** inventoryValue - ledgerBalance: lo que hay que sumar (o restar, si es negativo) a la 1435 para cuadrar. */
  difference: number;
  /** El comprobante de regularizacion, si se aplico. */
  entry: JournalEntryRecord | null;
  /** true = empresa del combo Cajapro: su inventario vive en Cajapro, la conciliacion no aplica y no se regulariza. */
  cajaproCombo: boolean;
}

/** Si la empresa del contexto esta en el combo Cajapro (su suscripcion vigente es un plan COMBO_CAJAPRO*). */
export interface ICajaproComboChecker {
  isCajaproCombo(): Promise<boolean>;
}

const INVENTORY_ACCOUNT_PREFIX = "1435";

/**
 * Concilia la cuenta 1435 contra el inventario valorizado real y, si se pide, registra el asiento de regularizacion por
 * la diferencia (Debito/Credito 1435 contra 3115 Aportes sociales). Existe porque hasta el 2026-11-10 las existencias
 * iniciales, entradas manuales y ajustes movian inventario sin asiento, y la 1435 quedaba descuadrada (incluso en
 * negativo, porque las ventas si la descargan). Es idempotente: una vez cuadrada, la diferencia es 0 y no registra nada.
 */
export class RegularizeInventoryAccountUseCase {
  constructor(
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly journalRepo: IJournalEntryRepository,
    private readonly inventoryValueReader: IInventoryValueReader,
    private readonly postInventoryEntry: PostInventoryJournalEntryUseCase,
    private readonly comboChecker: ICajaproComboChecker
  ) {}

  /**
   * En el combo Cajapro el inventario (productos, existencias, costos) vive en Cajapro: Contapro no tiene capas, asi que
   * "el inventario real" de Contapro seria 0 y regularizar dejaria la 1435 en cero contra 3115, que esta mal. Para esas
   * empresas solo se informa el saldo de la 1435 y se rechaza la regularizacion.
   */
  async execute(options: { apply: boolean }): Promise<InventoryReconciliation> {
    const cajaproCombo = await this.comboChecker.isCajaproCombo();
    if (cajaproCombo && options.apply) {
      throw new ValidationError(
        "Esta empresa usa el combo con Cajapro: su inventario se maneja en Cajapro, asi que la 1435 no se regulariza contra el inventario de Contapro."
      );
    }
    const accounts = await this.accountRepo.list();
    const inventoryAccountIds = new Set(accounts.filter((a) => a.code.startsWith(INVENTORY_ACCOUNT_PREFIX)).map((a) => a.id));
    const lines = inventoryAccountIds.size ? await this.journalRepo.listPostedLines({}) : [];
    const ledgerBalance = round2(lines.filter((l) => inventoryAccountIds.has(l.accountId)).reduce((s, l) => s + l.debit - l.credit, 0));
    if (cajaproCombo) return { ledgerBalance, inventoryValue: 0, difference: 0, entry: null, cajaproCombo };
    const inventoryValue = round2(await this.inventoryValueReader.totalValue());
    const difference = round2(inventoryValue - ledgerBalance);

    let entry: JournalEntryRecord | null = null;
    if (options.apply && Math.abs(difference) >= 0.01) {
      entry = await this.postInventoryEntry.execute({
        kind: "REGULARIZATION",
        amount: difference,
        date: new Date(),
        branchId: null,
        sourceType: "InventoryRegularization",
        sourceId: new Date().toISOString(),
        description: "Regularizacion de la cuenta 1435 contra el inventario valorizado real",
      });
    }

    return { ledgerBalance, inventoryValue, difference, entry, cajaproCombo };
  }
}
