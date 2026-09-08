import type {
  CreateProductInput,
  UpdateProductInput,
} from '@swe-challenge-stone/common';
import { httpClient } from '@/lib/http-client';
import type {
  ListProductsParams,
  ListProductsResponse,
  Product,
} from '@/types/api';

export const productsService = {
  list(params: ListProductsParams = {}): Promise<ListProductsResponse> {
    const searchParams: Record<string, string> = {};
    if (params.category) searchParams.category = params.category;
    if (params.name) searchParams.name = params.name;
    if (params.cursor) searchParams.cursor = params.cursor;

    return httpClient
      .get<ListProductsResponse>('products', { params: searchParams })
      .then((res) => res.data);
  },

  create(input: CreateProductInput): Promise<Product> {
    return httpClient.post<Product>('products', input).then((res) => res.data);
  },

  update(id: string, input: UpdateProductInput): Promise<Product> {
    return httpClient
      .patch<Product>(`products/${id}`, input)
      .then((res) => res.data);
  },

  deactivate(id: string): Promise<Product> {
    return this.update(id, { active: false });
  },

  remove(id: string): Promise<void> {
    return httpClient.delete(`products/${id}`).then(() => undefined);
  },
};
