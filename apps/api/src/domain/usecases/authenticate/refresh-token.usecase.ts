import { IssuedTokenPair } from '../../protocols/cryptography/encrypter.interface';

export const REFRESH_TOKEN_USE_CASE = Symbol('RefreshTokenUseCase');

export type RefreshTokenUseCaseInput = {
  refreshToken: string;
};

export type RefreshTokenUseCaseOutput = IssuedTokenPair;

export interface IRefreshTokenUseCase {
  execute(input: RefreshTokenUseCaseInput): Promise<RefreshTokenUseCaseOutput>;
}
