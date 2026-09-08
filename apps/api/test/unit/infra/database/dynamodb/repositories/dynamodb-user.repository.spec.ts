import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { EmailAlreadyRegisteredError } from '@/domain/errors/email-already-registered.error';
import { DynamoDbUserRepository } from '@/infra/database/dynamodb/repositories/dynamodb-user.repository';

describe('DynamoDbUserRepository', () => {
  function makeDocClientMock() {
    return { send: jest.fn() } as any;
  }

  function makeEnvMock() {
    return { get: jest.fn().mockReturnValue('Users') } as any;
  }

  const user = {
    email: 'user@example.com',
    userId: 'user-1',
    passwordHash: 'hashed',
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  describe('findByEmail', () => {
    it('returns the mapped domain model when the item exists', async () => {
      const docClient = makeDocClientMock();
      docClient.send.mockResolvedValueOnce({ Item: user });
      const repository = new DynamoDbUserRepository(docClient, makeEnvMock());

      await expect(repository.findByEmail('user@example.com')).resolves.toEqual(
        user,
      );
    });

    it('returns null when no item is found', async () => {
      const docClient = makeDocClientMock();
      docClient.send.mockResolvedValueOnce({});
      const repository = new DynamoDbUserRepository(docClient, makeEnvMock());

      await expect(
        repository.findByEmail('nobody@example.com'),
      ).resolves.toBeNull();
    });
  });

  describe('findById', () => {
    it('returns the mapped domain model when the item exists', async () => {
      const docClient = makeDocClientMock();
      docClient.send.mockResolvedValueOnce({ Items: [user] });
      const repository = new DynamoDbUserRepository(docClient, makeEnvMock());

      await expect(repository.findById('user-1')).resolves.toEqual(user);
    });

    it('returns null when no item is found', async () => {
      const docClient = makeDocClientMock();
      docClient.send.mockResolvedValueOnce({ Items: [] });
      const repository = new DynamoDbUserRepository(docClient, makeEnvMock());

      await expect(repository.findById('nobody')).resolves.toBeNull();
    });
  });

  describe('create', () => {
    it('persists the user', async () => {
      const docClient = makeDocClientMock();
      docClient.send.mockResolvedValueOnce({});
      const repository = new DynamoDbUserRepository(docClient, makeEnvMock());

      await repository.create(user);

      expect(docClient.send).toHaveBeenCalledTimes(1);
    });

    it('translates a conditional check failure into EmailAlreadyRegisteredError', async () => {
      const docClient = makeDocClientMock();
      docClient.send.mockRejectedValueOnce(
        new ConditionalCheckFailedException({
          message: 'failed',
          $metadata: {},
        }),
      );
      const repository = new DynamoDbUserRepository(docClient, makeEnvMock());

      await expect(repository.create(user)).rejects.toThrow(
        EmailAlreadyRegisteredError,
      );
    });

    it('propagates any other error unchanged', async () => {
      const docClient = makeDocClientMock();
      docClient.send.mockRejectedValueOnce(new Error('network blip'));
      const repository = new DynamoDbUserRepository(docClient, makeEnvMock());

      await expect(repository.create(user)).rejects.toThrow('network blip');
    });
  });
});
