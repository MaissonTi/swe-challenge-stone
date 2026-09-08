import type { ProductCategory } from '@swe-challenge-stone/common';

export type Product = {
  id: string;
  name: string;
  category: ProductCategory;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ListProductsResponse = {
  items: Product[];
  nextCursor?: string;
};

export type ListProductsParams = {
  category?: ProductCategory;
  name?: string;
  cursor?: string;
};

export type Profile = {
  userId: string;
  email: string;
  createdAt: string;
};
