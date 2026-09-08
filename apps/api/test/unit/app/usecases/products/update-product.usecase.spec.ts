import { UpdateProductUseCase } from '@/app/usecases/products/update-product.usecase';
import { ProductNotFoundError } from '@/domain/errors/product-not-found.error';
import { makeProductListCacheMock } from '../../../../mocks/product-list-cache.mock';
import { makeProductRepositoryMock } from '../../../../mocks/product-repository.mock';

describe('UpdateProductUseCase', () => {
  const updated = {
    productId: 'p1',
    name: 'Novo nome',
    category: 'ELECTRONICS' as const,
    active: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  };

  it('delegates the update to the repository with the given changes', async () => {
    const productRepository = makeProductRepositoryMock();
    const cache = makeProductListCacheMock();
    productRepository.update.mockResolvedValueOnce(updated);
    const useCase = new UpdateProductUseCase(productRepository, cache);

    const result = await useCase.execute({
      productId: 'p1',
      name: 'Novo nome',
      active: false,
    });

    expect(productRepository.update).toHaveBeenCalledWith('p1', {
      name: 'Novo nome',
      active: false,
    });
    expect(result).toBe(updated);
  });

  it('invalidates cached listings after a successful update', async () => {
    const productRepository = makeProductRepositoryMock();
    const cache = makeProductListCacheMock();
    productRepository.update.mockResolvedValueOnce(updated);
    const useCase = new UpdateProductUseCase(productRepository, cache);

    await useCase.execute({ productId: 'p1', active: false });

    expect(cache.bumpGeneration).toHaveBeenCalledTimes(1);
  });

  it('still resolves when cache invalidation fails', async () => {
    const productRepository = makeProductRepositoryMock();
    const cache = makeProductListCacheMock();
    productRepository.update.mockResolvedValueOnce(updated);
    cache.bumpGeneration.mockRejectedValueOnce(new Error('redis down'));
    const useCase = new UpdateProductUseCase(productRepository, cache);

    await expect(
      useCase.execute({ productId: 'p1', active: false }),
    ).resolves.toBe(updated);
  });

  it('does not invalidate the cache when the product does not exist', async () => {
    const productRepository = makeProductRepositoryMock();
    const cache = makeProductListCacheMock();
    productRepository.update.mockRejectedValueOnce(new ProductNotFoundError());
    const useCase = new UpdateProductUseCase(productRepository, cache);

    await expect(
      useCase.execute({ productId: 'does-not-exist', name: 'X' }),
    ).rejects.toThrow(ProductNotFoundError);
    expect(cache.bumpGeneration).not.toHaveBeenCalled();
  });
});
