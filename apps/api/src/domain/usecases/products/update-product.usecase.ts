import { ProductCategory } from '@swe-challenge-stone/common';
import { ProductModel } from '../../models/product.model';

export const UPDATE_PRODUCT_USE_CASE = Symbol('UpdateProductUseCase');

export type UpdateProductUseCaseInput = {
  productId: string;
  name?: string;
  category?: ProductCategory;
  active?: boolean;
};

export type UpdateProductUseCaseOutput = ProductModel;

export interface IUpdateProductUseCase {
  execute(
    input: UpdateProductUseCaseInput,
  ): Promise<UpdateProductUseCaseOutput>;
}
