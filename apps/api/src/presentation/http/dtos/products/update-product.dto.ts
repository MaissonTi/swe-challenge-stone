import { updateProductSchema } from '@swe-challenge-stone/common';
import { createZodDto } from 'nestjs-zod';

export { updateProductSchema };
export class UpdateProductDto extends createZodDto(updateProductSchema) {}
