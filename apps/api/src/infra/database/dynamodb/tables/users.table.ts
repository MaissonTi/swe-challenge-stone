/**
 * Users table - the dominant access pattern is look up by e-mail (login,
 * and uniqueness check on registration), so email IS the primary key.
 *
 * `userId` is what the JWT `sub` claim carries, and has its own access
 * pattern (GET /auth/me: token → userId → profile), so it also gets a GSI
 * rather than requiring the token to carry the e-mail as well.
 */
export const USERS_GSI1_NAME = 'byUserId';

export type UserItem = {
  email: string;
  userId: string;
  passwordHash: string;
  createdAt: string;
};
