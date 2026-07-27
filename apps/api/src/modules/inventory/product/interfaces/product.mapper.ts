import type { Product } from "../domain/product.entity";
import type { ProductResponseDto } from "../application/dtos/product.dto";

export function toProductResponse(product: Product): ProductResponseDto {
  return product.toProps;
}
