import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../presentation/http/dtos/common/error-response.dto';

/**
 * `RateLimitGuard` is global (`infra.module.ts`), so any route can
 * respond 429. Applied at the class level of each controller to
 * document this once instead of repeating it per handler. Routes with
 * their own limit (register, login) still declare their own
 * `@ApiResponse({ status: 429 })` with the specific number.
 */
export const ApiRateLimited = () =>
  ApiTooManyRequestsResponse({
    description:
      'Rate limit exceeded. The `Retry-After` header gives the number of ' +
      'seconds to wait. Default limit is 100 requests/minute per ' +
      'identity (user id when authenticated, client IP otherwise) and route.',
    type: ErrorResponseDto,
    headers: {
      'Retry-After': {
        description: 'Seconds to wait before retrying.',
        schema: { type: 'integer' },
      },
    },
  });

/**
 * Marks the route as protected by a Bearer token and documents the
 * corresponding 401. Used at the class level of the products
 * controller and on the protected handlers of the auth controller.
 */
export const ApiBearerProtected = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: 'Missing, expired, or revoked access token.',
      type: ErrorResponseDto,
    }),
  );
