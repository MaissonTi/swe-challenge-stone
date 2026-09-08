import { UserModel } from '../../../../domain/models/user.model';
import { UserItem } from '../tables/users.table';

/**
 * Seam between the domain model and the DynamoDB item shape. Today they
 * are identical field-for-field, but keeping the mapping explicit means
 * the persisted shape can diverge (e.g. internal-only attributes) without
 * ever touching the domain model or use cases.
 */
export class UserMapper {
  static toDomain(item: UserItem): UserModel {
    return {
      userId: item.userId,
      email: item.email,
      passwordHash: item.passwordHash,
      createdAt: item.createdAt,
    };
  }

  static toItem(model: UserModel): UserItem {
    return {
      email: model.email,
      userId: model.userId,
      passwordHash: model.passwordHash,
      createdAt: model.createdAt,
    };
  }
}
