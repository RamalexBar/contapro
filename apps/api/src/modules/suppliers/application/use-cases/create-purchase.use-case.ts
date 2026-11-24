import { calculateTax, round2 } from "@erp/shared-utils";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { PostPurchaseJournalEntryUseCase } from "../../../accounting/application/use-cases/post-purchase-journal-entry.use-case";
import type { GenerateElectronicSupportDocumentUseCase } from "../../../electronic-invoicing/application/use-cases/generate-electronic-support-document.use-case";
import type { IWithholdingConceptRepository } from "../../../accounting/domain/withholding-concept.repository";
import { sumWithholdingsByType } from "../../../accounting/application/sum-withholdings-by-type";
import { resolvePurchaseWithholding } from "../../../accounting/application/resolve-purchase-withholding";
import type { ISupplierRepository } from "../../domain/supplier.repository";
import type { ComputedPurchaseWithholding, CreatePurchaseData, IPurchaseRepository, PurchaseRecord } from "../../domain/purchase.repository";
import type { IProductRepository } from "../../../inventory/product/domain/product.repository";
import type { CreateProductUseCase } from "../../../inventory/product/application/use-cases/create-product.use-case";
import { createSkuSequence, normalizeSkuKey } from "../../../inventory/product/application/sku-sequence";
import type { ReceiveGoodsUseCase } from "./receive-goods.use-case";

/** Entrada de retencion pedida por quien registra la compra, antes de resolver el concepto. */
export interface PurchaseWithholdingInput {
  withholdingConceptId: string;
  base: number;
}

/** Producto que trae la factura y todavia no existe en Contapro -- se crea al registrar la compra. */
export interface PurchaseNewProductInput {
  name: string;
  /** Precio de venta antes de IVA, igual que en el formulario de producto. */
  salePrice: number;
  taxRate?: number;
  barcode?: string;
  unit?: string;
}

/** Renglon de la factura que entra al inventario: un producto existente (productId) o uno nuevo. */
export interface PurchaseItemInput {
  productId?: string;
  newProduct?: PurchaseNewProductInput;
  quantity: number;
  /** Costo unitario antes de IVA (ya con el descuento del proveedor, si lo hubo). */
  unitCost: number;
}

export type CreatePurchaseInput = Omit<CreatePurchaseData, "retentionTotal" | "withholdings"> & {
  withholdings: PurchaseWithholdingInput[];
  items?: PurchaseItemInput[];
};

/** UVT del año (sale de los parametros legales que mantiene el panel de plataforma). */
export interface IUvtProvider {
  uvtForYear(year: number): Promise<number | null>;
}

export type CreatePurchaseResult = PurchaseRecord & {
  /** Retenciones pedidas que no se practicaron (la base no alcanza el minimo), con el motivo. */
  skippedWithholdings: string[];
  /** Recepcion de mercancia creada con la compra -- null si la compra no trajo productos. */
  goodsReceiptId: string | null;
  createdProductIds: string[];
};

/** Dependencias de inventario: solo se usan cuando la compra trae renglones de productos. */
export interface PurchaseInventoryDeps {
  productRepo: IProductRepository;
  createProduct: CreateProductUseCase;
  receiveGoods: ReceiveGoodsUseCase;
}

const DEFAULT_NEW_PRODUCT_TAX_RATE = 19;
// Diferencia admitida entre la suma de los renglones y el subtotal de la factura, por redondeo de
// costos unitarios (ej. 3 x 333,33 contra 1.000): un peso por renglon.
const ITEMS_ROUNDING_TOLERANCE_PER_LINE = 1;

/**
 * Registro minimo de una factura de compra: crea el Purchase + su AccountPayable y contabiliza
 * de una vez el comprobante (Inventario, o la cuenta de `destinationAccount` si es un servicio,
 * + IVA descontable vs Proveedores). La orden de compra/recepcion de mercancia es un flujo
 * interno (PurchaseOrder/GoodsReceipt, con catalogo de productos e inventario reales) separado
 * de este -- un POS externo con su propio catalogo nunca las usa, solo esto (ver
 * public-api/README.md, decision confirmada con el usuario 2026-10-02).
 *
 * Si la compra trae `items` (renglones de la factura, normalmente leidos de la foto), ademas entra
 * la mercancia al inventario en el mismo paso: crea los productos nuevos, registra un GoodsReceipt
 * enlazado a la compra (purchaseId) y suma existencias/costo promedio igual que la recepcion contra
 * una orden de compra. Los renglones deben sumar el subtotal de la factura, porque el comprobante
 * debita Inventario (1435) por ese subtotal y el kardex tiene que valer lo mismo.
 */
export class CreatePurchaseUseCase {
  constructor(
    private readonly purchaseRepo: IPurchaseRepository,
    private readonly supplierRepo: ISupplierRepository,
    private readonly withholdingConceptRepo: IWithholdingConceptRepository,
    private readonly postPurchaseJournalEntry: PostPurchaseJournalEntryUseCase,
    private readonly generateElectronicSupportDocument: GenerateElectronicSupportDocumentUseCase,
    private readonly audit: AuditService,
    private readonly inventory: PurchaseInventoryDeps,
    private readonly uvtProvider: IUvtProvider | null = null
  ) {}

  async execute(data: CreatePurchaseInput): Promise<CreatePurchaseResult> {
    const supplier = await this.supplierRepo.findByIdOrThrow(data.supplierId);

    const expectedTotal = round2(data.subtotal + data.taxTotal);
    if (expectedTotal !== round2(data.total)) {
      throw new ValidationError(`El total (${data.total}) no coincide con subtotal + IVA (${expectedTotal})`);
    }

    // Retenciones que la empresa (compradora) le practica a este proveedor -- a diferencia de
    // ventas, aqui Contapro es quien retiene, ver post-purchase-journal-entry.use-case.ts. No
    // afectan `total` (el bruto legal de la factura del proveedor), solo lo que efectivamente se
    // le paga (ver PrismaPurchaseRepository.create, AccountPayable queda neto).
    let retentionTotal = 0;
    const computedWithholdings: ComputedPurchaseWithholding[] = [];
    const skippedWithholdings: string[] = [];
    const uvt = data.withholdings.length > 0 && this.uvtProvider ? await this.uvtProvider.uvtForYear(new Date().getFullYear()) : null;
    for (const w of data.withholdings) {
      const concept = await this.withholdingConceptRepo.findByIdOrThrow(w.withholdingConceptId);
      if (!concept.isActive) {
        throw new ValidationError(`El concepto de retencion ${concept.code} esta inactivo`);
      }
      if (w.base > data.subtotal) {
        throw new ValidationError(`La base de retencion (${w.base}) no puede superar el subtotal de la compra (${data.subtotal})`);
      }
      // Base minima en UVT y tarifa de no declarante (ver resolve-purchase-withholding.ts).
      const decision = resolvePurchaseWithholding({
        concept,
        base: w.base,
        purchaseSubtotal: data.subtotal,
        supplierDeclarant: supplier.incomeTaxDeclarant,
        uvt,
      });
      if (!decision.applies) {
        skippedWithholdings.push(decision.reason ?? concept.code);
        continue;
      }
      const amount = calculateTax(w.base, decision.ratePercent);
      retentionTotal = round2(retentionTotal + amount);
      computedWithholdings.push({
        withholdingConceptId: concept.id,
        type: concept.type,
        base: w.base,
        ratePercent: decision.ratePercent,
        amount,
      });
    }

    const items = data.items ?? [];
    if (items.length > 0) await this.validateItems(data, items);

    // Antes de la compra: si crear un producto falla, todavia no hay compra ni comprobante a medias.
    const createdProductIds: string[] = [];
    const receiptItems: { productId: string; quantity: number; unitCost: number }[] = [];
    // Nombre de cada renglon para el documento soporte (null = producto existente, se busca solo si hace falta).
    const itemNames: (string | null)[] = [];
    if (items.length > 0) {
      const taken = await this.inventory.productRepo.listTakenIdentifiers();
      const nextSku = createSkuSequence(taken.skus);
      for (const item of items) {
        let productId = item.productId;
        if (!productId && item.newProduct) {
          const product = await this.inventory.createProduct.execute(
            {
              sku: nextSku(),
              name: item.newProduct.name.trim(),
              unit: item.newProduct.unit || "UN",
              // El costo real lo fija la recepcion de abajo (promedio con 0 existencias = este costo).
              currentCost: item.unitCost,
              currentPrice: item.newProduct.salePrice,
              taxRate: item.newProduct.taxRate ?? DEFAULT_NEW_PRODUCT_TAX_RATE,
              barcode: item.newProduct.barcode?.trim() || undefined,
              initialStock: 0,
              minStock: 0,
              maxStock: 0,
            },
            data.branchId
          );
          productId = product.id;
          createdProductIds.push(product.id);
        }
        receiptItems.push({ productId: productId!, quantity: item.quantity, unitCost: item.unitCost });
        itemNames.push(item.newProduct ? item.newProduct.name.trim() : null);
      }
    }

    const purchase = await this.purchaseRepo.create({ ...data, retentionTotal, withholdings: computedWithholdings });

    await this.audit.record({
      action: "PURCHASE_REGISTERED",
      entityType: "Purchase",
      entityId: purchase.id,
      description: `Compra registrada: factura ${purchase.invoiceNumber} por ${purchase.total}`,
    });

    const journalEntry = await this.postPurchaseJournalEntry.execute({
      purchaseId: purchase.id,
      branchId: purchase.branchId,
      // Fecha real de la factura si se mando (ej. API publica, POS sincroniza dias despues) --
      // si no, el momento del registro, igual que siempre.
      date: data.date ?? purchase.createdAt,
      invoiceNumber: purchase.invoiceNumber,
      subtotal: purchase.subtotal,
      taxTotal: purchase.taxTotal,
      total: purchase.total,
      retentionTotal: purchase.retentionTotal,
      withholdingsByType: sumWithholdingsByType(purchase.withholdings),
      currency: purchase.currency,
      exchangeRate: purchase.exchangeRate,
      destinationAccount: data.destinationAccount,
    });
    if (journalEntry) {
      await this.purchaseRepo.setJournalEntryId(purchase.id, journalEntry.id);
      purchase.journalEntryId = journalEntry.id;
    }

    let goodsReceiptId: string | null = null;
    if (receiptItems.length > 0) {
      const receipt = await this.inventory.receiveGoods.execute({
        branchId: purchase.branchId,
        supplierId: purchase.supplierId,
        purchaseId: purchase.id,
        items: receiptItems,
      });
      goodsReceiptId = receipt.id;
    }

    if (!supplier.isObligatedToInvoice) {
      // El proveedor no puede expedir su propia factura electronica -- la empresa, como
      // compradora, debe generar el documento soporte. No bloquea el registro de la compra si
      // falla (ej. sin resolucion de numeracion vigente para documento soporte).
      try {
        const names: string[] = [];
        for (const [i, name] of itemNames.entries()) {
          names.push(name ?? (await this.inventory.productRepo.findById(receiptItems[i]!.productId))?.toProps?.name ?? "Producto");
        }
        await this.generateElectronicSupportDocument.execute({
          purchaseId: purchase.id,
          branchId: purchase.branchId,
          supplierId: data.supplierId,
          issueDate: purchase.createdAt,
          subtotal: purchase.subtotal,
          taxTotal: purchase.taxTotal,
          total: purchase.total,
          supplierReference: purchase.invoiceNumber,
          lines: supportDocumentLines(purchase, receiptItems, names, data.destinationAccount ? "Servicio" : "Compra"),
          // La retencion va en cada renglon (asi la recibe Factus): solo cuando se practico sobre
          // todo el subtotal; una base parcial no se puede repartir por renglon sin inventar.
          withholdings: purchase.withholdings
            .filter((w) => Math.abs(w.base - purchase.subtotal) <= 1)
            .map((w) => ({ type: w.type, ratePercent: w.ratePercent })),
          dueDate: purchase.dueDate,
        });
      } catch (err) {
        await this.audit.record({
          action: "ELECTRONIC_SUPPORT_DOCUMENT_GENERATION_FAILED",
          entityType: "Purchase",
          entityId: purchase.id,
          description: `No se pudo generar el documento soporte electronico: ${(err as Error).message}`,
          metadata: {},
        });
      }
    }

    return { ...purchase, goodsReceiptId, createdProductIds, skippedWithholdings };
  }

  /** Todo se revisa antes de crear nada (productos, compra o comprobante). */
  private async validateItems(data: CreatePurchaseInput, items: PurchaseItemInput[]): Promise<void> {
    if (data.destinationAccount) {
      throw new ValidationError("Una compra de servicios (con cuenta de gasto) no puede traer productos para el inventario");
    }

    const itemsTotal = round2(items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0));
    const tolerance = items.length * ITEMS_ROUNDING_TOLERANCE_PER_LINE;
    if (Math.abs(itemsTotal - round2(data.subtotal)) > tolerance) {
      throw new ValidationError(
        `Los productos suman ${itemsTotal} y el subtotal de la factura es ${round2(data.subtotal)}. Revisa cantidades y costos (antes de IVA y con descuentos)`
      );
    }

    const taken = await this.inventory.productRepo.listTakenIdentifiers();
    const takenBarcodes = new Set(taken.barcodes.map(normalizeSkuKey));
    const newBarcodes = new Set<string>();

    for (const [index, item] of items.entries()) {
      const line = index + 1;
      if (item.productId) {
        const product = await this.inventory.productRepo.findById(item.productId);
        if (!product) throw new ValidationError(`Renglon ${line}: el producto elegido no existe`);
        continue;
      }
      if (!item.newProduct) throw new ValidationError(`Renglon ${line}: elige un producto o crea uno nuevo`);
      const barcode = item.newProduct.barcode?.trim();
      if (barcode) {
        const key = normalizeSkuKey(barcode);
        if (takenBarcodes.has(key)) {
          throw new ValidationError(
            `Renglon ${line}: el codigo de barras ${barcode} ya es de otro producto. Elige ese producto en vez de crear uno nuevo`
          );
        }
        if (newBarcodes.has(key)) throw new ValidationError(`Renglon ${line}: el codigo de barras ${barcode} esta repetido en la factura`);
        newBarcodes.add(key);
      }
    }
  }
}

/** Tarifa de IVA de la compra (las compras guardan solo el IVA total): la estandar mas cercana. */
export function purchaseTaxRate(subtotal: number, taxTotal: number): number {
  if (subtotal <= 0 || taxTotal <= 0) return 0;
  const effective = (taxTotal / subtotal) * 100;
  const standard = [19, 5].find((rate) => Math.abs(effective - rate) <= 0.5);
  return standard ?? round2(effective);
}

/**
 * Renglones del documento soporte: los productos que entraron al inventario o, si la compra no
 * trajo productos (un servicio), un solo renglon por el subtotal.
 */
export function supportDocumentLines(
  purchase: { invoiceNumber: string; subtotal: number; taxTotal: number },
  items: { quantity: number; unitCost: number }[],
  names: string[],
  kind: string
) {
  const taxPercent = purchaseTaxRate(purchase.subtotal, purchase.taxTotal);
  if (items.length === 0) {
    return [{ code: "DS-1", description: `${kind} segun soporte ${purchase.invoiceNumber}`, quantity: 1, unitPrice: round2(purchase.subtotal), taxPercent }];
  }
  return items.map((item, i) => ({
    code: `DS-${i + 1}`,
    description: names[i] ?? "Producto",
    quantity: item.quantity,
    unitPrice: item.unitCost,
    taxPercent,
  }));
}
