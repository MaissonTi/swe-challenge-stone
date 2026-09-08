import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { VerifiedTokenPayload } from '../../domain/protocols/cryptography/encrypter.interface';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): VerifiedTokenPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
