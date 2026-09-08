export const HASHER = Symbol('Hasher');

/** Port for password hashing. Adapter: infra/cryptography/argon2-hasher.ts */
export interface IHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hashed: string): Promise<boolean>;
}
