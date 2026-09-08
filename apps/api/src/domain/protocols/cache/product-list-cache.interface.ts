import { ProductListPage } from '../database/repositories/product.repository.interface';

export const PRODUCT_LIST_CACHE = Symbol('ProductListCache');

/**
 * Port for the product listing's read-through cache. Adapter:
 * infra/cache/redis-product-list-cache.ts. Cache-aside with a short TTL
 * (see docs/PRD.md, §4.4) - expected to fail safe (get(): null, set():
 * no-op, getGeneration(): 0, bumpGeneration(): no-op) if the backing
 * store is unreachable, so a cache outage degrades to reading DynamoDB
 * directly instead of failing requests.
 */
export interface IProductListCache {
  get(cacheKey: string): Promise<ProductListPage | null>;
  set(
    cacheKey: string,
    page: ProductListPage,
    ttlSeconds: number,
  ): Promise<void>;

  /**
   * Current cache generation. Every listing cache key is scoped to this
   * value, so bumping it (see bumpGeneration) makes every previously
   * written key unreachable. Fails open: resolves to 0 when the backing
   * store is unreachable, and a read against a fresh generation is a
   * plain cache miss that falls back to the data store.
   */
  getGeneration(): Promise<number>;

  /**
   * Invalidates every cached listing by bumping the generation. Called
   * after any product write (create, update/deactivation, delete).
   * Fails open: a backing-store outage is swallowed and stale entries
   * age out via their own TTL instead of failing the write.
   */
  bumpGeneration(): Promise<void>;
}
