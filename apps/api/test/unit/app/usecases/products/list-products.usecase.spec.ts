import { ListProductsUseCase } from '@/app/usecases/products/list-products.usecase';
import { makeProductListCacheMock } from '../../../../mocks/product-list-cache.mock';
import { makeProductRepositoryMock } from '../../../../mocks/product-repository.mock';

describe('ListProductsUseCase', () => {
  const samplePage = {
    items: [
      {
        productId: 'p1',
        name: 'Notebook',
        category: 'ELECTRONICS' as const,
        active: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ],
    nextCursor: undefined,
  };

  it('returns the cached page without querying the repository on a cache hit', async () => {
    const productRepository = makeProductRepositoryMock();
    const cache = makeProductListCacheMock();
    cache.get.mockResolvedValueOnce(samplePage);
    const useCase = new ListProductsUseCase(productRepository, cache);

    const result = await useCase.execute({});

    expect(result).toBe(samplePage);
    expect(productRepository.list).not.toHaveBeenCalled();
  });

  it('queries the repository and populates the cache on a cache miss', async () => {
    const productRepository = makeProductRepositoryMock();
    const cache = makeProductListCacheMock();
    cache.get.mockResolvedValueOnce(null);
    productRepository.list.mockResolvedValueOnce(samplePage);
    const useCase = new ListProductsUseCase(productRepository, cache);

    const result = await useCase.execute({ category: 'ELECTRONICS' });

    expect(productRepository.list).toHaveBeenCalledWith(
      { category: 'ELECTRONICS', namePrefix: undefined },
      undefined,
      expect.any(Number),
    );
    expect(cache.set).toHaveBeenCalledWith(
      expect.any(String),
      samplePage,
      expect.any(Number),
    );
    expect(result).toBe(samplePage);
  });

  it('builds distinct cache keys for different filter/cursor combinations', async () => {
    const productRepository = makeProductRepositoryMock();
    const cache = makeProductListCacheMock();
    cache.get.mockResolvedValue(null);
    productRepository.list.mockResolvedValue(samplePage);
    const useCase = new ListProductsUseCase(productRepository, cache);

    await useCase.execute({ category: 'ELECTRONICS' });
    await useCase.execute({ category: 'BOOKS' });

    const [firstKey] = cache.get.mock.calls[0];
    const [secondKey] = cache.get.mock.calls[1];
    expect(firstKey).not.toEqual(secondKey);
  });

  it('scopes the cache key to the current generation, so a bump misses the old entry', async () => {
    const productRepository = makeProductRepositoryMock();
    const cache = makeProductListCacheMock();
    cache.get.mockResolvedValue(null);
    productRepository.list.mockResolvedValue(samplePage);
    const useCase = new ListProductsUseCase(productRepository, cache);

    cache.getGeneration.mockResolvedValueOnce(3);
    await useCase.execute({ category: 'ELECTRONICS' });
    cache.getGeneration.mockResolvedValueOnce(4);
    await useCase.execute({ category: 'ELECTRONICS' });

    const [keyBeforeBump] = cache.get.mock.calls[0];
    const [keyAfterBump] = cache.get.mock.calls[1];
    expect(keyBeforeBump).not.toEqual(keyAfterBump);
    expect(keyAfterBump).toContain('v4');
  });
});
