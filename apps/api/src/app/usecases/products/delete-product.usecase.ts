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
  DeleteProductUseCaseInput,
  IDeleteProductUseCase,
} from '../../../domain/usecases/products/delete-product.usecase';
import {
  TraceSpan,
  TracePrefixEnum,
} from '../../../observability/trace.decorator';

@Injectable()
export class DeleteProductUseCase implements IDeleteProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,
    @Inject(PRODUCT_LIST_CACHE)
    private readonly productListCache: IProductListCache,
  ) {}

  @TraceSpan({ prefix: TracePrefixEnum.UseCase })
  async execute({ productId }: DeleteProductUseCaseInput): Promise<void> {
    await this.productRepository.delete(productId);
    // Best effort: a listing invalidation that fails must not fail the
    // write itself (see specs/products: "Read-Path Caching").
    await this.productListCache.bumpGeneration().catch(() => undefined);
  }
}
