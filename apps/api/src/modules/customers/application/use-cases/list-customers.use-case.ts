import type { CustomerRecord, ICustomerRepository } from "../../domain/customer.repository";

export class ListCustomersUseCase {
  constructor(private readonly repo: ICustomerRepository) {}
  async execute(search?: string): Promise<CustomerRecord[]> {
    return this.repo.list(search);
  }
}
