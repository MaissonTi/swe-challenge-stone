export const GET_PROFILE_USE_CASE = Symbol('GetProfileUseCase');

export type GetProfileUseCaseInput = {
  userId: string;
};

export type GetProfileUseCaseOutput = {
  userId: string;
  email: string;
  createdAt: string;
};

export interface IGetProfileUseCase {
  execute(input: GetProfileUseCaseInput): Promise<GetProfileUseCaseOutput>;
}
