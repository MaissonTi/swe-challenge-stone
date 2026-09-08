import { IProductRepository } from '@/domain/protocols/database/repositories/product.repository.interface';

export function makeProductRepositoryMock(): jest.Mocked<IProductRepository> {
  return {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findById: jest.fn(),
    list: jest.fn(),
  };
}
