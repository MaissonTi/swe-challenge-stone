import { BadRequestException } from '@nestjs/common';
import { createZodValidationPipe } from 'nestjs-zod';
import { ZodError } from 'zod';

/**
 * Groups a ZodError's issues by field (`path`), joining every violated
 * rule's message for that field into a single array. nestjs-zod's
 * default returns one item per issue (`error.errors`, raw `ZodIssue[]`)
 * - a field with 3 violated rules becomes 3 entries repeating the same
 * path, each carrying Zod-internal fields (`code`, `validation`,
 * `inclusive`, `exact`, ...) that mean nothing to the client. Issues
 * with no path (e.g. a `.refine()` on the whole object) fall into
 * `_root`.
 */
function groupIssuesByPath(
  error: ZodError,
): Array<{ path: string; messages: string[] }> {
  const groups = new Map<string, string[]>();
  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join('.') : '_root';
    const messages = groups.get(path) ?? [];
    messages.push(issue.message);
    groups.set(path, messages);
  }
  return Array.from(groups.entries()).map(([path, messages]) => ({
    path,
    messages,
  }));
}

/**
 * Replaces nestjs-zod's default `ZodValidationPipe` (registered
 * globally in `main.ts`) only in how the 400 error is formatted -
 * validation behavior itself (schema per DTO) doesn't change.
 */
export const ZodValidationPipe = createZodValidationPipe({
  createValidationException: (error) =>
    new BadRequestException({
      statusCode: 400,
      message: 'Validation failed',
      errors: groupIssuesByPath(error),
    }),
});
