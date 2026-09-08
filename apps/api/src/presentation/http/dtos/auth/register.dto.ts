import { registerSchema } from '@swe-challenge-stone/common';
import { createZodDto } from 'nestjs-zod';

export { registerSchema };
export class RegisterDto extends createZodDto(registerSchema) {}
