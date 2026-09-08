import { Inject, Injectable } from '@nestjs/common';
import { UserNotFoundError } from '../../../domain/errors/user-not-found.error';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../../domain/protocols/database/repositories/user.repository.interface';
import {
  GetProfileUseCaseInput,
  GetProfileUseCaseOutput,
  IGetProfileUseCase,
} from '../../../domain/usecases/user/get-profile.usecase';
import {
  TraceSpan,
  TracePrefixEnum,
} from '../../../observability/trace.decorator';

@Injectable()
export class GetProfileUseCase implements IGetProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
  ) {}

  @TraceSpan({ prefix: TracePrefixEnum.UseCase })
  async execute({
    userId,
  }: GetProfileUseCaseInput): Promise<GetProfileUseCaseOutput> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    return {
      userId: user.userId,
      email: user.email,
      createdAt: user.createdAt,
    };
  }
}
