import {
  decodeCursor,
  encodeCursor,
} from '@/infra/database/dynamodb/cursor.util';

describe('cursor.util', () => {
  it('returns undefined when encoding an undefined key', () => {
    expect(encodeCursor(undefined)).toBeUndefined();
  });

  it('round-trips a key through encode/decode', () => {
    const key = {
      productId: 'p1',
      gsi1pk: 'ELECTRONICS#true',
      nameSortKey: 'notebook#p1',
    };

    const cursor = encodeCursor(key);
    expect(cursor).toEqual(expect.any(String));
    // Opaque: the raw key shape must not be readable without decoding.
    expect(cursor).not.toMatch(/productId/);

    expect(decodeCursor(cursor)).toEqual(key);
  });

  it('returns undefined when decoding an undefined cursor', () => {
    expect(decodeCursor(undefined)).toBeUndefined();
  });

  it('returns undefined (first page) for a malformed/tampered cursor instead of throwing', () => {
    expect(decodeCursor('not-valid-base64url-json')).toBeUndefined();
  });
});
