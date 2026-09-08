export const REGISTER_USER_USE_CASE = Symbol('RegisterUserUseCase');

export type RegisterUserUseCaseInput = {
  email: string;
  password: string;
};

export interface IRegisterUserUseCase {
  execute(input: RegisterUserUseCaseInput): Promise<void>;
}
