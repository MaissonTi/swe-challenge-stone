import { z } from 'zod';

export const productCategorySchema = z.enum([
  'ELECTRONICS',
  'CLOTHING',
  'HOME',
  'BOOKS',
  'TOYS',
  'FOOD',
  'OTHER',
]);

export type ProductCategory = z.infer<typeof productCategorySchema>;

/**
 * Shared between apps/api (DTO validation) and apps/web (form validation),
 * so the create/update rules can't drift between server and client.
 */
export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  category: productCategorySchema,
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    category: productCategorySchema.optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateProductInput = z.infer<typeof updateProductSchema>;
