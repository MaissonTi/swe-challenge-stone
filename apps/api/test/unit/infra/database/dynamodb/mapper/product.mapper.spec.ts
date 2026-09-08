import { ProductMapper } from '@/infra/database/dynamodb/mapper/product.mapper';
import { ProductModel } from '@/domain/models/product.model';

describe('ProductMapper', () => {
  const model: ProductModel = {
    productId: 'p1',
    name: 'Notebook Gamer',
    category: 'ELECTRONICS',
    active: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  it('derives the GSI keys and normalized name when mapping to an item', () => {
    const item = ProductMapper.toItem(model);

    expect(item.nameLower).toBe('notebook gamer');
    expect(item.gsi1pk).toBe('ELECTRONICS#true');
    expect(item.gsi2pk).toBe('true');
    expect(item.nameSortKey).toBe('notebook gamer#p1');
  });

  it('recomputes the GSI keys when active changes', () => {
    const item = ProductMapper.toItem({ ...model, active: false });

    expect(item.gsi1pk).toBe('ELECTRONICS#false');
    expect(item.gsi2pk).toBe('false');
  });

  it('maps an item back to the domain model, dropping the internal-only attributes', () => {
    const item = ProductMapper.toItem(model);

    expect(ProductMapper.toDomain(item)).toEqual(model);
  });
});
