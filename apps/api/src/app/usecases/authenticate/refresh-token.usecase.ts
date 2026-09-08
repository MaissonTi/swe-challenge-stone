import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  ENCRYPTER,
  IEncrypter,
  VerifiedTokenPayload,
} from '../../../domain/protocols/cryptography/encrypter.interface';
import {
  ITokenRevocationStore,
  TOKEN_REVOCATION_STORE,
} from '../../../domain/protocols/cache/token-revocation-store.interface';
import {
  IRefreshTokenUseCase,
  RefreshTokenUseCaseInput,
  RefreshTokenUseCaseOutput,
} from '../../../domain/usecases/authenticate/refresh-token.usecase';
import {
  TraceSpan,
  TracePrefixEnum,
} from '../../../observability/trace.decorator';

@Injectable()
export class RefreshTokenUseCase implements IRefreshTokenUseCase {
  constructor(
    @Inject(ENCRYPTER) private readonly encrypter: IEncrypter,
    @Inject(TOKEN_REVOCATION_STORE)
    private readonly revocationStore: ITokenRevocationStore,
  ) {}

  @TraceSpan({ prefix: TracePrefixEnum.UseCase })
  async execute({
    refreshToken,
  }: RefreshTokenUseCaseInput): Promise<RefreshTokenUseCaseOutput> {
    const payload = this.verifyRefreshToken(refreshToken);
    const now = Math.floor(Date.now() / 1000);
    const remaining = Math.max(payload.exp - now, 0);

    // isRevoked (not isTokenBlacklisted alone) - needs to cover both
    // cases: this specific jti was already used (direct reuse), OR the
    // whole family was already revoked because a sibling token was
    // reused (see block below). Without the second case, a refresh
    // token that was never used survives its own family's cascading
    // revocation - exactly the scenario that cascade exists to cover.
    const revoked = await this.revocationStore.isRevoked(
      payload.jti,
      payload.familyId,
    );
    if (revoked) {
      // Reaffirm the family revocation (idempotent if already revoked) -
      // ensures no other token from it survives either.
      await this.revocationStore.blacklistFamily(
        payload.familyId,
        this.encrypter.refreshTtlSeconds,
      );
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    // Rotation: this refresh token is now consumed.
    await this.revocationStore.blacklistToken(payload.jti, remaining);

    return this.encrypter.issueTokenPair(payload.sub, payload.familyId);
  }

  private verifyRefreshToken(token: string): VerifiedTokenPayload {
    let payload: VerifiedTokenPayload;
    try {
      payload = this.encrypter.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return payload;
  }
}
