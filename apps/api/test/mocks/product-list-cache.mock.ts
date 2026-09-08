import { IProductListCache } from '@/domain/protocols/cache/product-list-cache.interface';

export function makeProductListCacheMock(): jest.Mocked<IProductListCache> {
  return {
    get: jest.fn(),
    set: jest.fn(),
    getGeneration: jest.fn().mockResolvedValue(0),
    bumpGeneration: jest.fn().mockResolvedValue(undefined),
  };
}
