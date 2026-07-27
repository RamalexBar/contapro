import { PrismaBrandRepository } from "./infrastructure/prisma-brand.repository";
import { CreateBrandUseCase } from "./application/use-cases/create-brand.use-case";
import { ListBrandsUseCase } from "./application/use-cases/list-brands.use-case";
import { BrandController } from "./interfaces/brand.controller";

const repo = new PrismaBrandRepository();
export const brandController = new BrandController(new CreateBrandUseCase(repo), new ListBrandsUseCase(repo));
