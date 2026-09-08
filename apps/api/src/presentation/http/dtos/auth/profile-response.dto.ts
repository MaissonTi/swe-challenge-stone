import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const profileResponseSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
});

export class ProfileResponseDto extends createZodDto(profileResponseSchema) {}
