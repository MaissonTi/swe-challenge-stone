import { createProductSchema } from '@swe-challenge-stone/common';
import { createZodDto } from 'nestjs-zod';

export { createProductSchema };
export class CreateProductDto extends createZodDto(createProductSchema) {}
