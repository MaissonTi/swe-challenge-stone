import { ProductNotFoundError } from '@/domain/errors/product-not-found.error';
import { ProductModel } from '@/domain/models/product.model';
import { DynamoDbProductRepository } from '@/infra/database/dynamodb/repositories/dynamodb-product.repository';

describe('DynamoDbProductRepository', () => {
  function makeDocClientMock() {
    return { send: jest.fn() } as any;
  }

  function makeEnvMock() {
    return { get: jest.fn().mockReturnValue('Products') } as any;
  }

  const product: ProductModel = {
    productId: 'p1',
    name: 'Notebook',
    category: 'ELECTRONICS',
    active: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  describe('create', () => {
    it('persists the product', async () => {
      const docClient = makeDocClientMock();
      docClient.send.mockResolvedValueOnce({});
      const repository = new DynamoDbProductRepository(
        docClient,
        makeEnvMock(),
      );

      await repository.create(product);

      expect(docClient.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('findById', () => {
    it('returns the mapped model when found', async () => {
      const docClient = makeDocClientMock();
      docClient.send.mockResolvedValueOnce({
        Item: {
          productId: 'p1',
          name: 'Notebook',
          nameLower: 'notebook',
          category: 'ELECTRONICS',
          active: true,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
          gsi1pk: 'ELECTRONICS#true',
          gsi2pk: 'true',
          nameSortKey: 'notebook#p1',
        },
      });
      const repository = new DynamoDbProductRepository(
        docClient,
        makeEnvMock(),
      );

      await expect(repository.findById('p1')).resolves.toEqual(product);
    });

    it('returns null when not found', async () => {
      const docClient = makeDocClientMock();
      docClient.send.mockResolvedValueOnce({});
      const repository = new DynamoDbProductRepository(
        docClient,
        makeEnvMock(),
      );

      await expect(repository.findById('does-not-exist')).resolves.toBeNull();
    });
  });

  describe('update', () => {
    it('merges changes onto the existing product and recomputes derived keys', async () => {
      const docClient = makeDocClientMock();
      docClient.send
        .mockResolvedValueOnce({
          Item: {
            productId: 'p1',
            name: 'Notebook',
            nameLower: 'notebook',
            category: 'ELECTRONICS',
            active: true,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
            gsi1pk: 'ELECTRONICS#true',
            gsi2pk: 'true',
            nameSortKey: 'notebook#p1',
          },
        })
        .mockResolvedValueOnce({});
      const repository = new DynamoDbProductRepository(
        docClient,
        makeEnvMock(),
      );

      const updated = await repository.update('p1', { active: false });

      expect(updated.active).toBe(false);
      expect(updated.name).toBe('Notebook');
      const putCall = docClient.send.mock.calls[1][0];
      expect(putCall.input.Item.gsi1pk).toBe('ELECTRONICS#false');
      expect(putCall.input.ConditionExpression).toBe(
        'attribute_exists(productId)',
      );
    });

    it('throws ProductNotFoundError when the product does not exist', async () => {
      const docClient = makeDocClientMock();
      docClient.send.mockResolvedValueOnce({});
      const repository = new DynamoDbProductRepository(
        docClient,
        makeEnvMock(),
      );

      await expect(
        repository.update('does-not-exist', { active: false }),
      ).rejects.toThrow(ProductNotFoundError);
    });
  });

  describe('delete', () => {
    it('sends a physical delete', async () => {
      const docClient = makeDocClientMock();
      docClient.send.mockResolvedValueOnce({});
      const repository = new DynamoDbProductRepository(
        docClient,
        makeEnvMock(),
      );

      await repository.delete('p1');

      expect(docClient.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('list', () => {
    it('queries the category GSI when a category filter is given', async () => {
      const docClient = makeDocClientMock();
      docClient.send.mockResolvedValueOnce({ Items: [] });
      const repository = new DynamoDbProductRepository(
        docClient,
        makeEnvMock(),
      );

      await repository.list({ category: 'ELECTRONICS' }, undefined, 20);

      const query = docClient.send.mock.calls[0][0].input;
      expect(query.IndexName).toBe('byCategoryActive');
      expect(query.KeyConditionExpression).toBe('gsi1pk = :pk');
      expect(query.ExpressionAttributeValues).toEqual({
        ':pk': 'ELECTRONICS#true',
      });
    });

    it('queries the active-only GSI when no category filter is given', async () => {
      const docClient = makeDocClientMock();
      docClient.send.mockResolvedValueOnce({ Items: [] });
      const repository = new DynamoDbProductRepository(
        docClient,
        makeEnvMock(),
      );

      await repository.list({}, undefined, 20);

      const query = docClient.send.mock.calls[0][0].input;
      expect(query.IndexName).toBe('byActive');
      expect(query.KeyConditionExpression).toBe('gsi2pk = :pk');
      expect(query.ExpressionAttributeValues).toEqual({ ':pk': 'true' });
    });

    it('adds a begins_with condition on the sort key when a name prefix is given', async () => {
      const docClient = makeDocClientMock();
      docClient.send.mockResolvedValueOnce({ Items: [] });
      const repository = new DynamoDbProductRepository(
        docClient,
        makeEnvMock(),
      );

      await repository.list(
        { category: 'BOOKS', namePrefix: 'Clean' },
        undefined,
        20,
      );

      const query = docClient.send.mock.calls[0][0].input;
      expect(query.KeyConditionExpression).toBe(
        'gsi1pk = :pk AND begins_with(nameSortKey, :prefix)',
      );
      // Lower-cased, matching the case-insensitive prefix contract.
      expect(query.ExpressionAttributeValues[':prefix']).toBe('clean');
    });

    it('passes the decoded cursor as ExclusiveStartKey and returns an opaque nextCursor', async () => {
      const docClient = makeDocClientMock();
      docClient.send.mockResolvedValueOnce({
        Items: [],
        LastEvaluatedKey: {
          productId: 'p2',
          gsi1pk: 'ELECTRONICS#true',
          nameSortKey: 'x#p2',
        },
      });
      const repository = new DynamoDbProductRepository(
        docClient,
        makeEnvMock(),
      );

      const cursorIn = Buffer.from(
        JSON.stringify({
          productId: 'p1',
          gsi1pk: 'ELECTRONICS#true',
          nameSortKey: 'a#p1',
        }),
      ).toString('base64url');

      const page = await repository.list(
        { category: 'ELECTRONICS' },
        cursorIn,
        20,
      );

      const query = docClient.send.mock.calls[0][0].input;
      expect(query.ExclusiveStartKey).toEqual({
        productId: 'p1',
        gsi1pk: 'ELECTRONICS#true',
        nameSortKey: 'a#p1',
      });
      expect(page.nextCursor).toEqual(expect.any(String));
      expect(page.nextCursor).not.toMatch(/productId/);
    });

    it('omits nextCursor when there is no LastEvaluatedKey', async () => {
      const docClient = makeDocClientMock();
      docClient.send.mockResolvedValueOnce({ Items: [] });
      const repository = new DynamoDbProductRepository(
        docClient,
        makeEnvMock(),
      );

      const page = await repository.list({}, undefined, 20);

      expect(page.nextCursor).toBeUndefined();
    });
  });
});
