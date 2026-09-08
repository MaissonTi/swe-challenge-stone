import { context } from '@opentelemetry/api';
import { Trace } from './trace-span';

/**
 * Follows this project's own layer vocabulary (domain/app/infra)
 * instead of the source kit's (`Gateway`/`Adapter`/`Consumer`, which
 * don't apply here - no message broker or external gateway calls).
 */
export enum TracePrefixEnum {
  UseCase = 'usecase',
  Repository = 'repository',
  Cache = 'cache',
}

type TraceSpanOptions = {
  prefix?: TracePrefixEnum;
};

/**
 * Child-span decorator for methods below the HTTP entry point (use
 * cases, DynamoDB repositories, Redis adapters). The root span itself
 * is opened by `TracingInterceptor`, not by this decorator - see the
 * "Root span: global NestInterceptor" decision in design.md.
 *
 * Becomes a no-op when there's no active trace (see `Trace.span()`): a
 * method decorated with `@TraceSpan()` and called directly, with no
 * active HTTP request context - exactly what every existing unit test
 * does - behaves identically to the method without the decorator.
 */
export function TraceSpan(options?: TraceSpanOptions): MethodDecorator {
  return function (target, propertyKey, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const spanName = buildSpanName(
        `${target.constructor.name}.${String(propertyKey)}`,
        options?.prefix,
      );
      const span = new Trace(spanName).span();

      if (!span.valid()) {
        return originalMethod.apply(this, args);
      }

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

    return descriptor;
  };
}

function buildSpanName(name: string, prefix?: TracePrefixEnum): string {
  return prefix ? `${prefix}.${name}` : name;
}
