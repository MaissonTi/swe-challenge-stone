/**
 * Encodes/decodes DynamoDB's LastEvaluatedKey as an opaque cursor token,
 * so the API never exposes the internal key structure to clients (see
 * design.md - pagination).
 */
export function encodeCursor(
  lastEvaluatedKey: Record<string, unknown> | undefined,
): string | undefined {
  if (!lastEvaluatedKey) return undefined;
  return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64url');
}

export function decodeCursor(
  cursor: string | undefined,
): Record<string, unknown> | undefined {
  if (!cursor) return undefined;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    // Invalid/tampered cursor - treat as the first page rather than erroring.
    return undefined;
  }
}
