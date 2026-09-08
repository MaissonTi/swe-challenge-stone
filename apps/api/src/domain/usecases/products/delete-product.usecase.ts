export const DELETE_PRODUCT_USE_CASE = Symbol('DeleteProductUseCase');

export type DeleteProductUseCaseInput = {
  productId: string;
};

export interface IDeleteProductUseCase {
  execute(input: DeleteProductUseCaseInput): Promise<void>;
}
