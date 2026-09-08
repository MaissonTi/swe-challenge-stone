import { productCategorySchema } from '@swe-challenge-stone/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ProductModel } from '../../../domain/models/product.model';

export const productHttpSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: productCategorySchema,
  active: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export class ProductHttpDto extends createZodDto(productHttpSchema) {}

export class ProductPresenter {
  static toHTTP(product: ProductModel): ProductHttpDto {
    return {
      id: product.productId,
      name: product.name,
      category: product.category,
      active: product.active,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
