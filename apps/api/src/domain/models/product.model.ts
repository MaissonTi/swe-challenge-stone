import { ProductCategory } from '@swe-challenge-stone/common';

export type ProductModel = {
  productId: string;
  name: string;
  category: ProductCategory;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
