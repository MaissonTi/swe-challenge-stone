import { ProductCategory } from '@swe-challenge-stone/common';
import { ProductListPage } from '../../protocols/database/repositories/product.repository.interface';

export const LIST_PRODUCTS_USE_CASE = Symbol('ListProductsUseCase');

export type ListProductsUseCaseInput = {
  category?: ProductCategory;
  namePrefix?: string;
  cursor?: string;
};

export type ListProductsUseCaseOutput = ProductListPage;

export interface IListProductsUseCase {
  execute(input: ListProductsUseCaseInput): Promise<ListProductsUseCaseOutput>;
}
