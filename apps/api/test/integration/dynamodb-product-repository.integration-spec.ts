import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { EnvService } from '@/infra/env/env.service';
import { DynamoDbProductRepository } from '@/infra/database/dynamodb/repositories/dynamodb-product.repository';
import { ProductNotFoundError } from '@/domain/errors/product-not-found.error';
import { ProductModel } from '@/domain/models/product.model';

/**
 * Requires the local stack up (`docker compose up -d` + tables
 * bootstrapped) - exercises the real GSI queries directly, without the
 * Redis cache in front (that's covered separately, at the use-case level,
 * with a mocked cache). This is the only tier that can actually verify
 * the category/active/name-prefix key design works as modeled.
 */
describe('DynamoDbProductRepository (integration)', () => {
  let repository: DynamoDbProductRepository;
  const createdIds: string[] = [];

  beforeAll(() => {
    const env = new EnvService();
    const client = new DynamoDBClient({
      region: env.get('AWS_REGION'),
      endpoint: env.get('DYNAMODB_ENDPOINT'),
    });
    const docClient = DynamoDBDocumentClient.from(client);
    repository = new DynamoDbProductRepository(docClient, env);
  });

  afterAll(async () => {
    // Best-effort cleanup so repeated runs don't accumulate garbage.
    await Promise.all(createdIds.map((id) => repository.delete(id)));
  });

  function makeProduct(overrides: Partial<ProductModel> = {}): ProductModel {
    const now = new Date().toISOString();
    const product: ProductModel = {
      productId: randomUUID(),
      name: `Integration Product ${randomUUID()}`,
      category: 'ELECTRONICS',
      active: true,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
    createdIds.push(product.productId);
    return product;
  }

  it('creates and finds a product by id', async () => {
    const product = makeProduct();
    await repository.create(product);

    const found = await repository.findById(product.productId);

    expect(found).toEqual(product);
  });

  it('returns null for an id that does not exist', async () => {
    await expect(repository.findById(randomUUID())).resolves.toBeNull();
  });

  it('excludes deactivated products from category listing', async () => {
    const category = 'BOOKS';
    const active = makeProduct({
      category,
      name: `Active Book ${randomUUID()}`,
    });
    const inactive = makeProduct({
      category,
      name: `Inactive Book ${randomUUID()}`,
      active: false,
    });
    await repository.create(active);
    await repository.create(inactive);

    const page = await repository.list({ category }, undefined, 50);
    const ids = page.items.map((item) => item.productId);

    expect(ids).toContain(active.productId);
    expect(ids).not.toContain(inactive.productId);
  });

  it('filters by case-insensitive name prefix within a category', async () => {
    const category = 'TOYS';
    const marker = randomUUID();
    const matching = makeProduct({ category, name: `Zyx-${marker} Robot` });
    const nonMatching = makeProduct({
      category,
      name: `Different ${marker} Item`,
    });
    await repository.create(matching);
    await repository.create(nonMatching);

    const page = await repository.list(
      { category, namePrefix: `zyx-${marker}` },
      undefined,
      50,
    );
    const ids = page.items.map((item) => item.productId);

    expect(ids).toContain(matching.productId);
    expect(ids).not.toContain(nonMatching.productId);
  });

  it('filters by name prefix across the whole catalog when no category is given', async () => {
    const marker = randomUUID();
    const product = makeProduct({
      category: 'FOOD',
      name: `Global-${marker} Snack`,
    });
    await repository.create(product);

    const page = await repository.list(
      { namePrefix: `global-${marker}` },
      undefined,
      50,
    );

    expect(page.items.map((item) => item.productId)).toContain(
      product.productId,
    );
  });

  it('paginates with an opaque cursor that does not leak the internal key shape', async () => {
    const category = 'CLOTHING';
    const marker = randomUUID();
    const products = Array.from({ length: 3 }, (_, i) =>
      makeProduct({ category, name: `Page-${marker}-${i}` }),
    );
    for (const product of products) {
      await repository.create(product);
    }

    const firstPage = await repository.list(
      { category, namePrefix: `page-${marker}` },
      undefined,
      2,
    );
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.nextCursor).toEqual(expect.any(String));
    // Opaque: never the raw DynamoDB key shape (no productId/gsi1pk keys visible as JSON).
    expect(firstPage.nextCursor).not.toMatch(/productId/);

    const secondPage = await repository.list(
      { category, namePrefix: `page-${marker}` },
      firstPage.nextCursor,
      2,
    );
    expect(secondPage.items).toHaveLength(1);

    const allIds = [...firstPage.items, ...secondPage.items].map(
      (item) => item.productId,
    );
    expect(new Set(allIds)).toEqual(new Set(products.map((p) => p.productId)));
  });

  it('updates a product and recomputes its derived keys (category change reflected in listing)', async () => {
    const product = makeProduct({ category: 'HOME' });
    await repository.create(product);

    const updated = await repository.update(product.productId, {
      category: 'OTHER',
    });
    expect(updated.category).toBe('OTHER');

    const oldCategoryPage = await repository.list(
      { category: 'HOME' },
      undefined,
      50,
    );
    const newCategoryPage = await repository.list(
      { category: 'OTHER' },
      undefined,
      50,
    );

    expect(oldCategoryPage.items.map((i) => i.productId)).not.toContain(
      product.productId,
    );
    expect(newCategoryPage.items.map((i) => i.productId)).toContain(
      product.productId,
    );
  });

  it('throws ProductNotFoundError when updating a nonexistent product', async () => {
    await expect(
      repository.update(randomUUID(), { name: 'X' }),
    ).rejects.toThrow(ProductNotFoundError);
  });

  it('physically removes a product on delete', async () => {
    const product = makeProduct();
    await repository.create(product);

    await repository.delete(product.productId);

    await expect(repository.findById(product.productId)).resolves.toBeNull();
  });
});
