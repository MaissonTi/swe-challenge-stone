import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { IHasher } from '../../domain/protocols/cryptography/hasher.interface';

/**
 * OWASP baseline for argon2id: memory 19 MiB, 2 iterations, parallelism 1.
 * ~100ms per hash on a modern core; portable regardless of where compute
 * ends up running (see openspec/changes/add-auth-and-products-api/design.md).
 */
export const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class Argon2Hasher implements IHasher {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, ARGON2_OPTIONS);
  }

  compare(plain: string, hashed: string): Promise<boolean> {
    return argon2.verify(hashed, plain);
  }
}
