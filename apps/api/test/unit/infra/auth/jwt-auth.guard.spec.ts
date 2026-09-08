import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard';
import { IS_PUBLIC_KEY } from '@/infra/auth/public.decorator';

function makeExecutionContext(): ExecutionContext {
  // Stable references: getHandler()/getClass() must return the *same*
  // function/class object on every call, otherwise assertions comparing
  // "what the guard passed to the reflector" against "what we expect"
  // would compare two structurally-identical but distinct function
  // instances and fail on reference inequality.
  const handler = function exampleHandler() {};
  const controllerClass = class ExampleController {};
  return {
    getHandler: () => handler,
    getClass: () => controllerClass,
    switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
  } as any;
}

describe('JwtAuthGuard', () => {
  it('bypasses authentication entirely for routes marked @Public()', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as any;
    const guard = new JwtAuthGuard(reflector);
    const context = makeExecutionContext();

    expect(guard.canActivate(context)).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });

  it('delegates to the passport JWT strategy for non-public routes', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as any;
    const guard = new JwtAuthGuard(reflector);
    const superCanActivate = jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockReturnValue('delegated' as any);

    const result = guard.canActivate(makeExecutionContext());

    expect(result).toBe('delegated');
    superCanActivate.mockRestore();
  });
});
