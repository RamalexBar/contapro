import type { IUserDirectoryRepository, UserSummary } from "../../../rbac/domain/rbac.types";

/** Cualquier usuario activo de la empresa puede ser vendedor (Sale.sellerUserId no distingue por
 * rol) -- reusa el directorio de usuarios de RBAC en vez de un catalogo propio. */
export class ListSellersUseCase {
  constructor(private readonly userDirectoryRepo: IUserDirectoryRepository) {}

  async execute(): Promise<UserSummary[]> {
    const users = await this.userDirectoryRepo.list();
    return users.filter((u) => u.isActive);
  }
}
