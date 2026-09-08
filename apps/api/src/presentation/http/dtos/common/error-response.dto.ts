import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Error shape returned by Nest's default exception filter and by the
 * global Zod validation pipe (`main.ts`). `message` is always a
 * string - the constant "Validation failed" on a validation error, or
 * the exception's message in every other case (404, 401, 429, ...).
 * Only a validation error carries `errors`: one group per field
 * (`path`), with every violated rule's message for that field.
 */
export const errorResponseSchema = z.object({
  statusCode: z.number().int(),
  message: z.string(),
  error: z.string().optional(),
  errors: z
    .array(
      z.object({
        path: z.string(),
        messages: z.array(z.string()),
      }),
    )
    .optional(),
});

export class ErrorResponseDto extends createZodDto(errorResponseSchema) {}
