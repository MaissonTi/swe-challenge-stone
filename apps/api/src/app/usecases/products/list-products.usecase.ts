import { Inject, Injectable } from '@nestjs/common';
import {
  PRODUCT_LIST_CACHE,
  IProductListCache,
} from '../../../domain/protocols/cache/product-list-cache.interface';
import {
  IProductRepository,
  PRODUCT_REPOSITORY,
} from '../../../domain/protocols/database/repositories/product.repository.interface';
import {
  IListProductsUseCase,
  ListProductsUseCaseInput,
  ListProductsUseCaseOutput,
} from '../../../domain/usecases/products/list-products.usecase';
import {
  TraceSpan,
  TracePrefixEnum,
} from '../../../observability/trace.decorator';

const DEFAULT_PAGE_SIZE = 20;
/** Cache-aside TTL - 45s per docs/PRD.md, §4.4 (acceptable staleness between writes). */
const CACHE_TTL_SECONDS = 45;

@Injectable()
export class ListProductsUseCase implements IListProductsUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,
    @Inject(PRODUCT_LIST_CACHE) private readonly cache: IProductListCache,
  ) {}

  @TraceSpan({ prefix: TracePrefixEnum.UseCase })
  async execute(
    input: ListProductsUseCaseInput,
  ): Promise<ListProductsUseCaseOutput> {
    const generation = await this.cache.getGeneration();
    const cacheKey = this.buildCacheKey(input, generation);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const page = await this.productRepository.list(
      { category: input.category, namePrefix: input.namePrefix },
      input.cursor,
      DEFAULT_PAGE_SIZE,
    );

    await this.cache.set(cacheKey, page, CACHE_TTL_SECONDS);
    return page;
  }

  private buildCacheKey(
    input: ListProductsUseCaseInput,
    generation: number,
  ): string {
    return `products:list:v${generation}:${input.category ?? '-'}:${input.namePrefix ?? '-'}:${input.cursor ?? '-'}`;
  }
}
