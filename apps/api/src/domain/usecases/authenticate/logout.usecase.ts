export const LOGOUT_USE_CASE = Symbol('LogoutUseCase');

export type LogoutUseCaseInput = {
  accessJti: string;
  accessExp: number;
  refreshToken?: string;
};

export interface ILogoutUseCase {
  execute(input: LogoutUseCaseInput): Promise<void>;
}
