import { IHasher } from '@/domain/protocols/cryptography/hasher.interface';

export function makeHasherMock(): jest.Mocked<IHasher> {
  return {
    hash: jest.fn().mockResolvedValue('hashed-password'),
    compare: jest.fn(),
  };
}
