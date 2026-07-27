import { PrismaCustomerRepository } from "./infrastructure/prisma-customer.repository";
import { CreateCustomerUseCase } from "./application/use-cases/create-customer.use-case";
import { ListCustomersUseCase } from "./application/use-cases/list-customers.use-case";
import { CustomerController } from "./interfaces/customer.controller";

const repo = new PrismaCustomerRepository();
export const customerController = new CustomerController(new CreateCustomerUseCase(repo), new ListCustomersUseCase(repo));
