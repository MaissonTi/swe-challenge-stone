/** Minimal fake of the ioredis surface used by cache adapters. */
export function makeRedisClientMock() {
  return {
    set: jest.fn(),
    exists: jest.fn(),
  } as any;
}
