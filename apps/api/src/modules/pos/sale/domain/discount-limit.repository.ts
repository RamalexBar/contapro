export interface IDiscountLimitRepository {
  /** Retorna null si el usuario no tiene un limite configurado. */
  getMaxDiscountPercent(userId: string): Promise<number | null>;
}
