import { loginSchema } from '@swe-challenge-stone/common';
import { createZodDto } from 'nestjs-zod';

export { loginSchema };
export class LoginDto extends createZodDto(loginSchema) {}
