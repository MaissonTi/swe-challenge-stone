import { IssuedTokenPair } from '../../protocols/cryptography/encrypter.interface';

export const LOGIN_USE_CASE = Symbol('LoginUseCase');

export type LoginUseCaseInput = {
  email: string;
  password: string;
};

export type LoginUseCaseOutput = IssuedTokenPair;

export interface ILoginUseCase {
  execute(input: LoginUseCaseInput): Promise<LoginUseCaseOutput>;
}
