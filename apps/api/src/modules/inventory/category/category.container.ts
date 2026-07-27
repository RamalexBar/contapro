import { PrismaCategoryRepository } from "./infrastructure/prisma-category.repository";
import { CreateCategoryUseCase } from "./application/use-cases/create-category.use-case";
import { ListCategoriesUseCase } from "./application/use-cases/list-categories.use-case";
import { CategoryController } from "./interfaces/category.controller";

const repo = new PrismaCategoryRepository();
export const categoryController = new CategoryController(new CreateCategoryUseCase(repo), new ListCategoriesUseCase(repo));
