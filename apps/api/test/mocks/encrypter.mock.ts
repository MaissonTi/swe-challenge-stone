import { IEncrypter } from '@/domain/protocols/cryptography/encrypter.interface';

export function makeEncrypterMock(): jest.Mocked<IEncrypter> {
  return {
    accessTtlSeconds: 900,
    refreshTtlSeconds: 604800,
    issueTokenPair: jest.fn(),
    verify: jest.fn(),
  };
}
