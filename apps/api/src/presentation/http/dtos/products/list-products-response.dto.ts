import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { productHttpSchema } from '../../presenters/product.presenter';

export const listProductsResponseSchema = z.object({
  items: z.array(productHttpSchema),
  nextCursor: z.string().optional(),
});

export class ListProductsResponseDto extends createZodDto(
  listProductsResponseSchema,
) {}
