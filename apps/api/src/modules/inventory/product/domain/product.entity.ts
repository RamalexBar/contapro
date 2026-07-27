import { ValidationError } from "../../../../shared/errors/app-error";

export interface ProductProps {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  brandId: string | null;
  unit: string;
  currentCost: number;
  currentPrice: number;
  taxRate: number;
  isActive: boolean;
}

/**
 * Entidad de dominio pura (sin dependencias de Prisma/Express). Encapsula las reglas de
 * negocio de un producto, en particular la validacion de cambios de precio/costo que exige
 * el spec ("los precios NO podran ser modificados por cajeros" se hace cumplir a nivel de
 * permiso en la ruta; aqui se hace cumplir la INTEGRIDAD del dato: precio > 0, costo >= 0).
 */
export class Product {
  private constructor(private props: ProductProps) {}

  static fromPersistence(props: ProductProps): Product {
    return new Product(props);
  }

  get id() {
    return this.props.id;
  }
  get currentPrice() {
    return this.props.currentPrice;
  }
  get currentCost() {
    return this.props.currentCost;
  }
  get toProps(): ProductProps {
    return { ...this.props };
  }

  updatePrice(newPrice?: number, newCost?: number): void {
    if (newPrice === undefined && newCost === undefined) {
      throw new ValidationError("Debes enviar newPrice y/o newCost");
    }
    if (newPrice !== undefined) {
      if (newPrice <= 0) throw new ValidationError("El precio debe ser mayor a 0");
      this.props.currentPrice = newPrice;
    }
    if (newCost !== undefined) {
      if (newCost < 0) throw new ValidationError("El costo no puede ser negativo");
      this.props.currentCost = newCost;
    }
  }
}
