import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import {
  IEncrypter,
  IssuedTokenPair,
  TokenPayload,
  VerifiedTokenPayload,
} from '../../domain/protocols/cryptography/encrypter.interface';
import { EnvService } from '../env/env.service';

@Injectable()
export class JwtEncrypter implements IEncrypter {
  private readonly privateKey: string;
  private readonly publicKey: string;
  readonly accessTtlSeconds: number;
  readonly refreshTtlSeconds: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly env: EnvService,
  ) {
    this.privateKey = readFileSync(
      this.env.get('JWT_PRIVATE_KEY_PATH'),
      'utf8',
    );
    this.publicKey = readFileSync(this.env.get('JWT_PUBLIC_KEY_PATH'), 'utf8');
    this.accessTtlSeconds = this.env.get('JWT_ACCESS_TOKEN_TTL_SECONDS');
    this.refreshTtlSeconds = this.env.get('JWT_REFRESH_TOKEN_TTL_SECONDS');
  }

  issueTokenPair(
    userId: string,
    familyId: string = randomUUID(),
  ): IssuedTokenPair {
    const accessJti = randomUUID();
    const refreshJti = randomUUID();

    const accessToken = this.sign(
      { sub: userId, jti: accessJti, familyId, type: 'access' },
      this.accessTtlSeconds,
    );
    const refreshToken = this.sign(
      { sub: userId, jti: refreshJti, familyId, type: 'refresh' },
      this.refreshTtlSeconds,
    );

    return { accessToken, refreshToken, accessJti, refreshJti, familyId };
  }

  verify(token: string): VerifiedTokenPayload {
    return this.jwtService.verify(token, {
      algorithms: ['RS256'],
      publicKey: this.publicKey,
    });
  }

  private sign(payload: TokenPayload, ttlSeconds: number): string {
    return this.jwtService.sign(payload, {
      algorithm: 'RS256',
      privateKey: this.privateKey,
      expiresIn: ttlSeconds,
    });
  }
}
