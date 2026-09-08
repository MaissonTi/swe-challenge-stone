import { ProductCategory } from '@swe-challenge-stone/common';
import { ProductModel } from '../../models/product.model';

export const CREATE_PRODUCT_USE_CASE = Symbol('CreateProductUseCase');

export type CreateProductUseCaseInput = {
  name: string;
  category: ProductCategory;
};

export type CreateProductUseCaseOutput = ProductModel;

export interface ICreateProductUseCase {
  execute(
    input: CreateProductUseCaseInput,
  ): Promise<CreateProductUseCaseOutput>;
}
