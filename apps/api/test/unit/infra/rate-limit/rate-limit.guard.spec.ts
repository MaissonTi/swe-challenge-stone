import { HttpException } from '@nestjs/common';
import { RateLimitGuard } from '@/infra/rate-limit/rate-limit.guard';
import { makeRateLimiterMock } from '../../../mocks/rate-limiter.mock';

function makeExecutionContext(
  request: any,
  response: any = { setHeader: jest.fn() },
) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getHandler: () => function exampleHandler() {},
    getClass: () => class ExampleController {},
  } as any;
}

describe('RateLimitGuard', () => {
  it('allows the request and does not touch the response when under the limit', async () => {
    const rateLimiter = makeRateLimiterMock();
    rateLimiter.consume.mockResolvedValueOnce({
      allowed: true,
      retryAfterSeconds: 0,
    });
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as any;
    const guard = new RateLimitGuard(reflector, rateLimiter);
    const response = { setHeader: jest.fn() };
    const context = makeExecutionContext({ ip: '1.2.3.4' }, response);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(response.setHeader).not.toHaveBeenCalled();
  });

  it('rejects with 429 and sets Retry-After when over the limit', async () => {
    const rateLimiter = makeRateLimiterMock();
    rateLimiter.consume.mockResolvedValueOnce({
      allowed: false,
      retryAfterSeconds: 30,
    });
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as any;
    const guard = new RateLimitGuard(reflector, rateLimiter);
    const response = { setHeader: jest.fn() };
    const context = makeExecutionContext({ ip: '1.2.3.4' }, response);

    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '30');
  });

  it('keys by authenticated user id when request.user is present', async () => {
    const rateLimiter = makeRateLimiterMock();
    rateLimiter.consume.mockResolvedValueOnce({
      allowed: true,
      retryAfterSeconds: 0,
    });
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as any;
    const guard = new RateLimitGuard(reflector, rateLimiter);
    const context = makeExecutionContext({
      user: { sub: 'user-1' },
      ip: '1.2.3.4',
    });

    await guard.canActivate(context);

    expect(rateLimiter.consume).toHaveBeenCalledWith(
      expect.stringContaining('user:user-1'),
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('keys by IP when there is no authenticated user', async () => {
    const rateLimiter = makeRateLimiterMock();
    rateLimiter.consume.mockResolvedValueOnce({
      allowed: true,
      retryAfterSeconds: 0,
    });
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as any;
    const guard = new RateLimitGuard(reflector, rateLimiter);
    const context = makeExecutionContext({ ip: '1.2.3.4' });

    await guard.canActivate(context);

    expect(rateLimiter.consume).toHaveBeenCalledWith(
      expect.stringContaining('ip:1.2.3.4'),
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('uses the route-specific @RateLimit options when present', async () => {
    const rateLimiter = makeRateLimiterMock();
    rateLimiter.consume.mockResolvedValueOnce({
      allowed: true,
      retryAfterSeconds: 0,
    });
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue({ limit: 5, windowSeconds: 60 }),
    } as any;
    const guard = new RateLimitGuard(reflector, rateLimiter);
    const context = makeExecutionContext({ ip: '1.2.3.4' });

    await guard.canActivate(context);

    expect(rateLimiter.consume).toHaveBeenCalledWith(expect.any(String), 5, 60);
  });
});
