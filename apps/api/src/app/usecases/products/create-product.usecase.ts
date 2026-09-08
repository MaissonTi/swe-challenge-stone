import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ProductModel } from '../../../domain/models/product.model';
import {
  IProductListCache,
  PRODUCT_LIST_CACHE,
} from '../../../domain/protocols/cache/product-list-cache.interface';
import {
  IProductRepository,
  PRODUCT_REPOSITORY,
} from '../../../domain/protocols/database/repositories/product.repository.interface';
import {
  CreateProductUseCaseInput,
  CreateProductUseCaseOutput,
  ICreateProductUseCase,
} from '../../../domain/usecases/products/create-product.usecase';
import {
  TraceSpan,
  TracePrefixEnum,
} from '../../../observability/trace.decorator';

@Injectable()
export class CreateProductUseCase implements ICreateProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,
    @Inject(PRODUCT_LIST_CACHE)
    private readonly productListCache: IProductListCache,
  ) {}

  @TraceSpan({ prefix: TracePrefixEnum.UseCase })
  async execute({
    name,
    category,
  }: CreateProductUseCaseInput): Promise<CreateProductUseCaseOutput> {
    const now = new Date().toISOString();
    const product: ProductModel = {
      productId: randomUUID(),
      name,
      category,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    await this.productRepository.create(product);
    // Best effort: a listing invalidation that fails must not fail the
    // write itself (see specs/products: "Read-Path Caching").
    await this.productListCache.bumpGeneration().catch(() => undefined);
    return product;
  }
}
