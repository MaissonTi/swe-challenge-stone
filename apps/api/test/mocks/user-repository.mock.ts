import { IUserRepository } from '@/domain/protocols/database/repositories/user.repository.interface';

export function makeUserRepositoryMock(): jest.Mocked<IUserRepository> {
  return {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };
}
