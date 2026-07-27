import type { CreateCustomerData, CustomerRecord, ICustomerRepository } from "../../domain/customer.repository";

export class CreateCustomerUseCase {
  constructor(private readonly repo: ICustomerRepository) {}
  async execute(data: CreateCustomerData): Promise<CustomerRecord> {
    return this.repo.create(data);
  }
}
