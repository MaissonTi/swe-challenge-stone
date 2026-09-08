import { Inject, Injectable } from '@nestjs/common';
import {
  IProductListCache,
  PRODUCT_LIST_CACHE,
} from '../../../domain/protocols/cache/product-list-cache.interface';
import {
  IProductRepository,
  PRODUCT_REPOSITORY,
} from '../../../domain/protocols/database/repositories/product.repository.interface';
import {
  IUpdateProductUseCase,
  UpdateProductUseCaseInput,
  UpdateProductUseCaseOutput,
} from '../../../domain/usecases/products/update-product.usecase';
import {
  TraceSpan,
  TracePrefixEnum,
} from '../../../observability/trace.decorator';

@Injectable()
export class UpdateProductUseCase implements IUpdateProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,
    @Inject(PRODUCT_LIST_CACHE)
    private readonly productListCache: IProductListCache,
  ) {}

  @TraceSpan({ prefix: TracePrefixEnum.UseCase })
  async execute({
    productId,
    ...changes
  }: UpdateProductUseCaseInput): Promise<UpdateProductUseCaseOutput> {
    const updated = await this.productRepository.update(productId, changes);
    // Best effort: a listing invalidation that fails must not fail the
    // write itself (see specs/products: "Read-Path Caching").
    await this.productListCache.bumpGeneration().catch(() => undefined);
    return updated;
  }
}
