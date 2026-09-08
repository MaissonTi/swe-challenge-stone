import { UserModel } from '../../../models/user.model';

export const USER_REPOSITORY = Symbol('UserRepository');

/** Port for User persistence. Adapter: infra/database/dynamodb/repositories/dynamodb-user.repository.ts */
export interface IUserRepository {
  findByEmail(email: string): Promise<UserModel | null>;
  findById(userId: string): Promise<UserModel | null>;
  create(user: UserModel): Promise<void>;
}
