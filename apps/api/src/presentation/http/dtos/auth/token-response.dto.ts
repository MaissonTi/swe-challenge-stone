import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const tokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export class TokenResponseDto extends createZodDto(tokenResponseSchema) {}
