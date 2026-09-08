export const ENCRYPTER = Symbol('Encrypter');

export type TokenType = 'access' | 'refresh';

export type TokenPayload = {
  sub: string;
  jti: string;
  familyId: string;
  type: TokenType;
};

export type VerifiedTokenPayload = TokenPayload & {
  iat: number;
  exp: number;
};

export type IssuedTokenPair = {
  accessToken: string;
  refreshToken: string;
  accessJti: string;
  refreshJti: string;
  familyId: string;
};

/** Port for issuing/verifying signed tokens. Adapter: infra/cryptography/jwt-encrypter.ts */
export interface IEncrypter {
  readonly accessTtlSeconds: number;
  readonly refreshTtlSeconds: number;
  issueTokenPair(userId: string, familyId?: string): IssuedTokenPair;
  verify(token: string): VerifiedTokenPayload;
}
