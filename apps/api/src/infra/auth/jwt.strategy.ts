import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { readFileSync } from 'fs';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  ITokenRevocationStore,
  TOKEN_REVOCATION_STORE,
} from '../../domain/protocols/cache/token-revocation-store.interface';
import { VerifiedTokenPayload } from '../../domain/protocols/cryptography/encrypter.interface';
import { EnvService } from '../env/env.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(TOKEN_REVOCATION_STORE)
    private readonly revocationStore: ITokenRevocationStore,
    env: EnvService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: readFileSync(env.get('JWT_PUBLIC_KEY_PATH'), 'utf8'),
      algorithms: ['RS256'],
    });
  }

  async validate(payload: VerifiedTokenPayload): Promise<VerifiedTokenPayload> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const revoked = await this.revocationStore.isRevoked(
      payload.jti,
      payload.familyId,
    );
    if (revoked) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return payload;
  }
}
