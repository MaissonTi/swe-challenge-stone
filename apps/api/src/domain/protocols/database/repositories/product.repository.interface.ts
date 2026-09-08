import { ProductCategory } from '@swe-challenge-stone/common';
import { ProductModel } from '../../../models/product.model';

export const PRODUCT_REPOSITORY = Symbol('ProductRepository');

export type ProductListFilters = {
  category?: ProductCategory;
  namePrefix?: string;
};

export type ProductListPage = {
  items: ProductModel[];
  nextCursor?: string;
};

/** Port for Product persistence. Adapter: infra/database/dynamodb/repositories/dynamodb-product.repository.ts */
export interface IProductRepository {
  create(product: ProductModel): Promise<void>;
  /** Throws ProductNotFoundError if no product exists with this id. */
  update(
    productId: string,
    changes: Partial<Pick<ProductModel, 'name' | 'category' | 'active'>>,
  ): Promise<ProductModel>;
  /** Physical removal. Idempotent - deleting an already-gone id is not an error. */
  delete(productId: string): Promise<void>;
  findById(productId: string): Promise<ProductModel | null>;
  /**
   * Lists only active products, filtered/paginated. `cursor` is the
   * opaque token from a previous page's `nextCursor` (or undefined for
   * the first page).
   */
  list(
    filters: ProductListFilters,
    cursor: string | undefined,
    limit: number,
  ): Promise<ProductListPage>;
}
