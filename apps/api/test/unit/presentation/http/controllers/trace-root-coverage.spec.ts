import { AuthController } from '@/presentation/http/controllers/auth.controller';
import { HealthController } from '@/presentation/http/controllers/health.controller';
import { ProductsController } from '@/presentation/http/controllers/products.controller';
import { TRACE_ROOT_MARKER } from '@/observability/trace-root.decorator';

/**
 * The former global TracingInterceptor guaranteed no route could be
 * added without tracing. With the root span now opened by an explicit
 * @TraceRoot() on each handler (see the refine-observability-and-web-
 * fixes change), this guard replaces that guarantee: every public
 * method on every controller must carry the decorator.
 */
describe('@TraceRoot() covers every controller handler', () => {
  const controllers: Array<{ new (...args: never[]): unknown }> = [
    AuthController,
    HealthController,
    ProductsController,
  ];

  for (const Controller of controllers) {
    const prototype = Controller.prototype as Record<string, unknown>;
    const handlerNames = Object.getOwnPropertyNames(prototype).filter(
      (name) => name !== 'constructor' && typeof prototype[name] === 'function',
    );

    it.each(handlerNames)(
      `${Controller.name}.%s is decorated with @TraceRoot()`,
      (name) => {
        const handler = prototype[name] as Record<PropertyKey, unknown>;
        expect(handler[TRACE_ROOT_MARKER]).toBe(true);
      },
    );
  }
});
