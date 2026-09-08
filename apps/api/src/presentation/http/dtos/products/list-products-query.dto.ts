import { productCategorySchema } from '@swe-challenge-stone/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const listProductsQuerySchema = z.object({
  category: productCategorySchema.optional(),
  name: z.string().min(1).optional(),
  cursor: z.string().optional(),
});

export class ListProductsQueryDto extends createZodDto(
  listProductsQuerySchema,
) {}
