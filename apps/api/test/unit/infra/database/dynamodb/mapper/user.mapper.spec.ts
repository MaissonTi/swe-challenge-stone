import { UserMapper } from '@/infra/database/dynamodb/mapper/user.mapper';

describe('UserMapper', () => {
  const item = {
    email: 'user@example.com',
    userId: 'user-1',
    passwordHash: 'hashed',
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  it('maps an item to the domain model', () => {
    expect(UserMapper.toDomain(item)).toEqual(item);
  });

  it('maps a domain model back to an item (round-trip)', () => {
    const model = UserMapper.toDomain(item);

    expect(UserMapper.toItem(model)).toEqual(item);
  });
});
