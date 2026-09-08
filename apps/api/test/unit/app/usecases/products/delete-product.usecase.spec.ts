import { DeleteProductUseCase } from '@/app/usecases/products/delete-product.usecase';
import { makeProductListCacheMock } from '../../../../mocks/product-list-cache.mock';
import { makeProductRepositoryMock } from '../../../../mocks/product-repository.mock';

describe('DeleteProductUseCase', () => {
  it('delegates physical deletion to the repository', async () => {
    const productRepository = makeProductRepositoryMock();
    const cache = makeProductListCacheMock();
    const useCase = new DeleteProductUseCase(productRepository, cache);

    await useCase.execute({ productId: 'p1' });

    expect(productRepository.delete).toHaveBeenCalledWith('p1');
  });

  it('invalidates cached listings after the deletion', async () => {
    const productRepository = makeProductRepositoryMock();
    const cache = makeProductListCacheMock();
    const useCase = new DeleteProductUseCase(productRepository, cache);

    await useCase.execute({ productId: 'p1' });

    expect(cache.bumpGeneration).toHaveBeenCalledTimes(1);
  });

  it('still resolves when cache invalidation fails', async () => {
    const productRepository = makeProductRepositoryMock();
    const cache = makeProductListCacheMock();
    cache.bumpGeneration.mockRejectedValueOnce(new Error('redis down'));
    const useCase = new DeleteProductUseCase(productRepository, cache);

    await expect(useCase.execute({ productId: 'p1' })).resolves.toBeUndefined();
  });
});
