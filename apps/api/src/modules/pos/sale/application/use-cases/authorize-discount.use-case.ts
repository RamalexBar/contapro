import type { AuthorizeDiscountInput } from "@erp/shared-types";
import { getTenantContext } from "../../../../../shared/context/request-context";
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from "../../../../../shared/errors/app-error";
import type { AuditService } from "../../../../audit/application/audit.service";
import type { PostSaleJournalEntryUseCase } from "../../../../accounting/application/use-cases/post-sale-journal-entry.use-case";
import type { IUserRepository } from "../../../../auth/domain/user.repository";
import { verifySecret } from "../../../../auth/infrastructure/password-hasher.service";
import { prisma } from "../../../../../shared/prisma/prisma-client";
import type { ISaleRepository, SaleRecord } from "../../domain/sale.repository";

/**
 * Autorizacion de descuento (spec): registra QUIEN autorizo, QUIEN vendio, el PRODUCTO, el
 * DESCUENTO, el MOTIVO, fecha y hora. El autorizador debe tener el permiso `discount.authorize`
 * y validarse con PIN o usuario/contraseña.
 */
export class AuthorizeDiscountUseCase {
  constructor(
    private readonly saleRepo: ISaleRepository,
    private readonly userRepo: IUserRepository,
    private readonly postSaleJournalEntry: PostSaleJournalEntryUseCase,
    private readonly audit: AuditService
  ) {}

  async execute(saleId: string, input: AuthorizeDiscountInput): Promise<SaleRecord> {
    const authorizer = await this.userRepo.findByIdWithAccess(input.authorizerUserId);
    if (!authorizer || !authorizer.isActive) throw new NotFoundError("User", input.authorizerUserId);
    if (authorizer.companyId !== getTenantContext().companyId) {
      throw new ForbiddenError("El autorizador no pertenece a esta empresa");
    }
    if (!authorizer.permissions.includes("discount.authorize")) {
      throw new ForbiddenError("El usuario indicado no puede autorizar descuentos");
    }

    let method: "PIN" | "PASSWORD";
    if (input.pin) {
      if (!authorizer.pinHash || !(await verifySecret(input.pin, authorizer.pinHash))) {
        throw new UnauthorizedError("PIN incorrecto");
      }
      method = "PIN";
    } else if (input.password) {
      if (!(await verifySecret(input.password, authorizer.passwordHash))) {
        throw new UnauthorizedError("Contraseña incorrecta");
      }
      method = "PASSWORD";
    } else {
      throw new ValidationError("Se requiere pin o password del autorizador");
    }

    const sale = await this.saleRepo.findByIdOrThrow(saleId);
    const item = sale.items.find((i) => i.id === input.saleItemId);
    if (!item) throw new NotFoundError("SaleItem", input.saleItemId);

    const discountAuthorization = await prisma.discountAuthorization.create({
      data: {
        companyId: getTenantContext().companyId,
        saleId: sale.id,
        saleItemId: item.id,
        productId: item.productId,
        requestedByUserId: sale.sellerUserId ?? getTenantContext().userId,
        authorizedByUserId: authorizer.id,
        discountPercent: item.discountPercent,
        reason: input.reason,
        method,
      },
    });

    const updatedSale = await this.saleRepo.authorizeItemDiscount(sale.id, item.id, discountAuthorization.id);

    if (sale.status === "PENDING_AUTHORIZATION" && updatedSale.status === "COMPLETED") {
      await this.postSaleJournalEntry.execute({
        saleId: updatedSale.id,
        branchId: updatedSale.branchId,
        date: updatedSale.createdAt,
        number: updatedSale.number,
        subtotal: updatedSale.subtotal,
        discountTotal: updatedSale.discountTotal,
        taxTotal: updatedSale.taxTotal,
        total: updatedSale.total,
        payments: updatedSale.payments,
      });
    }

    await this.audit.record({
      action: "DISCOUNT_AUTHORIZED",
      entityType: "Sale",
      entityId: sale.id,
      description: `Descuento de ${item.discountPercent}% autorizado por ${authorizer.fullName} en producto ${item.productId}`,
      metadata: {
        saleItemId: item.id,
        productId: item.productId,
        discountPercent: item.discountPercent,
        authorizedByUserId: authorizer.id,
        requestedByUserId: sale.sellerUserId,
        reason: input.reason,
      },
    });

    return updatedSale;
  }
}
