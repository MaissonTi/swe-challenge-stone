import { CreateProductUseCase } from '@/app/usecases/products/create-product.usecase';
import { makeProductListCacheMock } from '../../../../mocks/product-list-cache.mock';
import { makeProductRepositoryMock } from '../../../../mocks/product-repository.mock';

describe('CreateProductUseCase', () => {
  it('creates a product active by default and persists it', async () => {
    const productRepository = makeProductRepositoryMock();
    const cache = makeProductListCacheMock();
    const useCase = new CreateProductUseCase(productRepository, cache);

    const result = await useCase.execute({
      name: 'Notebook',
      category: 'ELECTRONICS',
    });

    expect(result.active).toBe(true);
    expect(result.name).toBe('Notebook');
    expect(result.category).toBe('ELECTRONICS');
    expect(result.productId).toEqual(expect.any(String));
    expect(productRepository.create).toHaveBeenCalledWith(result);
  });

  it('invalidates cached listings after persisting the product', async () => {
    const productRepository = makeProductRepositoryMock();
    const cache = makeProductListCacheMock();
    const useCase = new CreateProductUseCase(productRepository, cache);

    await useCase.execute({ name: 'Notebook', category: 'ELECTRONICS' });

    expect(cache.bumpGeneration).toHaveBeenCalledTimes(1);
  });

  it('still resolves when cache invalidation fails', async () => {
    const productRepository = makeProductRepositoryMock();
    const cache = makeProductListCacheMock();
    cache.bumpGeneration.mockRejectedValueOnce(new Error('redis down'));
    const useCase = new CreateProductUseCase(productRepository, cache);

    await expect(
      useCase.execute({ name: 'Notebook', category: 'ELECTRONICS' }),
    ).resolves.toEqual(expect.objectContaining({ name: 'Notebook' }));
  });
});
