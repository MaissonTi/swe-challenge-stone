import { ProductCategory } from '@swe-challenge-stone/common';

/**
 * Products table - single primary key (productId) for get/update/delete,
 * plus two GSIs to support the listing access patterns without ever
 * scanning:
 *
 * - GSI1 "byCategoryActive": partition per (category, active) pair, sorted
 *   by name. Used when a category filter is present (with or without a
 *   name prefix).
 * - GSI2 "byActive": partition per active status only, covering the whole
 *   catalog, sorted by name. Used when there is no category filter (plain
 *   listing, or name-prefix filter with no category).
 *
 * Baking `active` into both GSI partition keys means "only active
 * products" never needs a FilterExpression - inactive items are simply
 * never in the queried partition.
 */
export const PRODUCTS_GSI1_NAME = 'byCategoryActive';
export const PRODUCTS_GSI2_NAME = 'byActive';

export type ProductItem = {
  productId: string;
  name: string;
  nameLower: string;
  category: ProductCategory;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  gsi1pk: string; // `${category}#${active}`
  gsi2pk: string; // `${active}`
  nameSortKey: string; // `${nameLower}#${productId}`
};

export function buildCategoryActiveKey(
  category: ProductCategory,
  active: boolean,
): string {
  return `${category}#${active}`;
}

export function buildActiveKey(active: boolean): string {
  return `${active}`;
}

export function buildNameSortKey(nameLower: string, productId: string): string {
  return `${nameLower}#${productId}`;
}
