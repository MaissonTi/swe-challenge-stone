import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  ENCRYPTER,
  IEncrypter,
} from '../../../domain/protocols/cryptography/encrypter.interface';
import {
  HASHER,
  IHasher,
} from '../../../domain/protocols/cryptography/hasher.interface';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../../domain/protocols/database/repositories/user.repository.interface';
import {
  ILoginUseCase,
  LoginUseCaseInput,
  LoginUseCaseOutput,
} from '../../../domain/usecases/authenticate/login.usecase';
import {
  TraceSpan,
  TracePrefixEnum,
} from '../../../observability/trace.decorator';

const DUMMY_PASSWORD_FOR_TIMING_SAFETY = 'dummy-password-for-timing-safety';

@Injectable()
export class LoginUseCase implements ILoginUseCase {
  private dummyHashPromise: Promise<string> | null = null;

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(HASHER) private readonly hasher: IHasher,
    @Inject(ENCRYPTER) private readonly encrypter: IEncrypter,
  ) {}

  @TraceSpan({ prefix: TracePrefixEnum.UseCase })
  async execute({
    email,
    password,
  }: LoginUseCaseInput): Promise<LoginUseCaseOutput> {
    const normalizedEmail = email.toLowerCase();
    const user = await this.userRepository.findByEmail(normalizedEmail);

    // Always compare against a real hash, even for a nonexistent user,
    // so response time doesn't reveal whether the account exists.
    const passwordHash = user?.passwordHash ?? (await this.getDummyHash());
    const passwordMatches = await this.hasher.compare(password, passwordHash);

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.encrypter.issueTokenPair(user.userId);
  }

  private getDummyHash(): Promise<string> {
    if (!this.dummyHashPromise) {
      this.dummyHashPromise = this.hasher.hash(
        DUMMY_PASSWORD_FOR_TIMING_SAFETY,
      );
    }
    return this.dummyHashPromise;
  }
}
