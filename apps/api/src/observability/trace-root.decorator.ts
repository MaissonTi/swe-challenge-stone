import { context } from '@opentelemetry/api';
import { Trace } from './trace-span';

/**
 * Extracts the authenticated user's id from the handler's own
 * arguments - typically the `@CurrentUser()` parameter. Returns
 * `undefined` on `@Public()` routes, where there's no user.
 */
export type TraceRootUserIdExtractor = (args: unknown[]) => string | undefined;

/**
 * Root-span decorator for HTTP controller handlers. Opens the
 * request's top-level span (via `Trace.spanRoot()`, which also records
 * the "active trace" marker plus the `userId` in OpenTelemetry baggage)
 * and runs the handler within that span's context, so every method
 * reached from the handler and decorated with `@TraceSpan()` (see
 * `trace.decorator.ts`) sees the marker and nests under this span.
 *
 * Applied directly on each controller handler - replaces the former
 * global `TracingInterceptor`. See the design.md on the
 * `refine-observability-and-web-fixes` change, which reverses
 * `add-tracing-observability`'s decision to use a "root span: global
 * NestInterceptor" in favor of opening the root span explicitly at
 * each entry point.
 *
 * `userIdFrom` reads the user id from the decorated method's
 * arguments; omit it on `@Public()` routes.
 */
/** Marker set on a wrapped handler so a guard test can assert every controller route carries `@TraceRoot()`. */
export const TRACE_ROOT_MARKER = Symbol('traceRoot');

export function TraceRoot(
  userIdFrom?: TraceRootUserIdExtractor,
): MethodDecorator {
  return function (target, propertyKey, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const spanName = `${target.constructor.name}.${String(propertyKey)}`;
      const span = new Trace(spanName).spanRoot({ userId: userIdFrom?.(args) });

      try {
        return await context.with(span.context(), () =>
          originalMethod.apply(this, args),
        );
      } catch (err) {
        span.exception(err as Error);
        throw err;
      } finally {
        span.finish();
      }
    };

    // Preserve the method's name on the wrapper. Without this the
    // wrapper is anonymous (`name === ''`) and @nestjs/swagger
    // generates a colliding `operationId` (`AuthController_`, without
    // the handler name) for every route on the controller - which
    // makes Swagger UI expand/collapse them all together.
    Object.defineProperty(descriptor.value, 'name', {
      value: String(propertyKey),
      configurable: true,
    });

    Object.defineProperty(descriptor.value, TRACE_ROOT_MARKER, {
      value: true,
      enumerable: false,
    });

    return descriptor;
  };
}
