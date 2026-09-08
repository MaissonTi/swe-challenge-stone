import {
  Context,
  context,
  propagation,
  Span as SpanOtel,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import { ITrace, TraceParams } from './trace-span.interface';

/**
 * Thin wrapper over the OpenTelemetry API. `spanRoot()` opens the
 * request's top-level span and records an "active trace" marker plus
 * the `userId` in baggage, which OpenTelemetry automatically propagates
 * across `await` boundaries via its context manager; `span()` opens a
 * child span only when that marker is present in the currently active
 * context. That's what makes a method decorated with `@TraceSpan()`
 * (see `trace.decorator.ts`) a true no-op - no span, no call to the
 * OTel API - when invoked outside a traced request (e.g. directly from
 * a unit test), per specs/observability: "No-Op Outside an Active
 * Trace".
 */
export class Trace implements ITrace {
  private static readonly TRACE_VALID = 'tracing.valid';
  private static readonly USER_ID = 'user.id';

  private _span: SpanOtel | undefined;
  private _ctx: Context = context.active();

  constructor(private readonly spanName: string) {}

  spanRoot({ userId }: TraceParams): Trace {
    this._ctx = context.active();

    const baggageEntries: Record<string, { value: string }> = {
      [Trace.TRACE_VALID]: { value: 'true' },
    };
    if (userId) baggageEntries[Trace.USER_ID] = { value: userId };
    this._ctx = propagation.setBaggage(
      this._ctx,
      propagation.createBaggage(baggageEntries),
    );

    const tracer = trace.getTracer('http-root');
    this._span = tracer.startSpan(this.spanName, undefined, this._ctx);
    if (userId) this._span.setAttribute(Trace.USER_ID, userId);
    this._span.setStatus({ code: SpanStatusCode.OK });

    return this;
  }

  span(): Trace {
    this._ctx = context.active();
    const baggage = propagation.getBaggage(this._ctx);
    const isTraceActive =
      baggage?.getEntry(Trace.TRACE_VALID)?.value !== undefined;

    if (!isTraceActive) return this;

    const userId = baggage?.getEntry(Trace.USER_ID)?.value;
    const tracer = trace.getTracer('span');
    this._span = tracer.startSpan(this.spanName, undefined, this._ctx);
    if (userId) this._span.setAttribute(Trace.USER_ID, userId);
    this._span.setStatus({ code: SpanStatusCode.OK });

    return this;
  }

  valid(): boolean {
    return this._span !== undefined;
  }

  context(): Context {
    if (!this._span) return context.active();
    return trace.setSpan(this._ctx, this._span);
  }

  exception(err: Error): void {
    if (!this._span) return;
    this._span.recordException(err);
    this._span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
  }

  finish(): void {
    this._span?.end();
  }
}
