import { Inject, Injectable } from '@nestjs/common';
import {
  ENCRYPTER,
  IEncrypter,
} from '../../../domain/protocols/cryptography/encrypter.interface';
import {
  ITokenRevocationStore,
  TOKEN_REVOCATION_STORE,
} from '../../../domain/protocols/cache/token-revocation-store.interface';
import {
  ILogoutUseCase,
  LogoutUseCaseInput,
} from '../../../domain/usecases/authenticate/logout.usecase';
import {
  TraceSpan,
  TracePrefixEnum,
} from '../../../observability/trace.decorator';

@Injectable()
export class LogoutUseCase implements ILogoutUseCase {
  constructor(
    @Inject(ENCRYPTER) private readonly encrypter: IEncrypter,
    @Inject(TOKEN_REVOCATION_STORE)
    private readonly revocationStore: ITokenRevocationStore,
  ) {}

  @TraceSpan({ prefix: TracePrefixEnum.UseCase })
  async execute({
    accessJti,
    accessExp,
    refreshToken,
  }: LogoutUseCaseInput): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.revocationStore.blacklistToken(
      accessJti,
      Math.max(accessExp - now, 0),
    );

    if (!refreshToken) return;

    try {
      const payload = this.encrypter.verify(refreshToken);
      await this.revocationStore.blacklistToken(
        payload.jti,
        Math.max(payload.exp - now, 0),
      );
    } catch {
      // Already expired or invalid - nothing to revoke.
    }
  }
}
