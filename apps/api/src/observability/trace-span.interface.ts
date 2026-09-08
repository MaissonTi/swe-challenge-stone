import { Context } from '@opentelemetry/api';

export type TraceParams = {
  userId?: string;
};

export interface ITrace {
  spanRoot(params: TraceParams): ITrace;
  span(): ITrace;
  valid(): boolean;
  context(): Context;
  exception(err: Error): void;
  finish(): void;
}
