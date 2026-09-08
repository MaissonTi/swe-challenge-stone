import {
  ProductPresenter,
  productHttpSchema,
} from '@/presentation/http/presenters/product.presenter';

describe('ProductPresenter', () => {
  it('maps the domain model to the HTTP shape, renaming productId to id', () => {
    const product = {
      productId: 'p1',
      name: 'Notebook',
      category: 'ELECTRONICS' as const,
      active: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    expect(ProductPresenter.toHTTP(product)).toEqual({
      id: 'p1',
      name: 'Notebook',
      category: 'ELECTRONICS',
      active: true,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    });
  });

  it('produces output that satisfies the documented response schema', () => {
    const product = {
      productId: '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
      name: 'Notebook Gamer 16GB',
      category: 'ELECTRONICS' as const,
      active: true,
      createdAt: '2026-01-15T12:34:56.000Z',
      updatedAt: '2026-01-15T12:34:56.000Z',
    };

    const parsed = productHttpSchema.safeParse(
      ProductPresenter.toHTTP(product),
    );

    expect(parsed.success).toBe(true);
  });
});
