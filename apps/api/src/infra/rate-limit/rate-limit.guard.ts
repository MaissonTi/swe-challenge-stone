import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  IRateLimiter,
  RATE_LIMITER,
} from '../../domain/protocols/cache/rate-limiter.interface';
import {
  DEFAULT_RATE_LIMIT,
  RATE_LIMIT_KEY,
  RateLimitOptions,
} from './rate-limit.decorator';

/**
 * Registered globally (see infra.module.ts), after JwtAuthGuard so
 * `request.user` is already populated on authenticated routes. Keys by
 * `userId` when authenticated, by IP otherwise (see docs/PRD.md, §4.3) -
 * combined with the route itself, so each route has its own bucket.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(RATE_LIMITER) private readonly rateLimiter: IRateLimiter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options =
      this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_RATE_LIMIT;

    const request = context.switchToHttp().getRequest();
    const routeKey = `${context.getClass().name}:${context.getHandler().name}`;
    const identityKey = this.resolveIdentityKey(request);
    const key = `${routeKey}:${identityKey}`;

    const result = await this.rateLimiter.consume(
      key,
      options.limit,
      options.windowSeconds,
    );

    if (!result.allowed) {
      const response = context.switchToHttp().getResponse();
      response.setHeader('Retry-After', String(result.retryAfterSeconds));
      throw new HttpException(
        'Too Many Requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private resolveIdentityKey(request: any): string {
    const userId = request.user?.sub;
    if (userId) return `user:${userId}`;
    const ip = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    return `ip:${ip}`;
  }
}
