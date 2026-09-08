import { ITokenRevocationStore } from '@/domain/protocols/cache/token-revocation-store.interface';

export function makeTokenRevocationStoreMock(): jest.Mocked<ITokenRevocationStore> {
  return {
    blacklistToken: jest.fn(),
    blacklistFamily: jest.fn(),
    isRevoked: jest.fn(),
    isTokenBlacklisted: jest.fn(),
  };
}
