import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  HASHER,
  IHasher,
} from '../../../domain/protocols/cryptography/hasher.interface';
import { EmailAlreadyRegisteredError } from '../../../domain/errors/email-already-registered.error';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../../domain/protocols/database/repositories/user.repository.interface';
import { UserModel } from '../../../domain/models/user.model';
import {
  IRegisterUserUseCase,
  RegisterUserUseCaseInput,
} from '../../../domain/usecases/user/register-user.usecase';
import {
  TraceSpan,
  TracePrefixEnum,
} from '../../../observability/trace.decorator';

@Injectable()
export class RegisterUserUseCase implements IRegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(HASHER) private readonly hasher: IHasher,
  ) {}

  @TraceSpan({ prefix: TracePrefixEnum.UseCase })
  async execute({ email, password }: RegisterUserUseCaseInput): Promise<void> {
    const normalizedEmail = email.toLowerCase();
    const passwordHash = await this.hasher.hash(password);
    const user: UserModel = {
      email: normalizedEmail,
      userId: randomUUID(),
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    try {
      await this.userRepository.create(user);
    } catch (err) {
      if (err instanceof EmailAlreadyRegisteredError) {
        // Swallow silently: the registration response must not reveal
        // whether the e-mail was already in use (see specs/user-auth).
        return;
      }
      throw err;
    }
  }
}
