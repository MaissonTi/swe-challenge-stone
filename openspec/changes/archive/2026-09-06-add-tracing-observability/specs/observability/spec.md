## Purpose

Provides distributed tracing of API requests — from HTTP entry through
use case execution to DynamoDB/Redis calls — exported to a local Jaeger
instance, so the actual per-request call chain is inspectable instead of
inferred from logs.

## ADDED Requirements

### Requirement: Trace Export via OTLP
The system SHALL export recorded spans via the OTLP protocol to a
configurable collector endpoint.

#### Scenario: Spans are exported to the configured endpoint
- **WHEN** the application processes a request that produces one or more
  spans
- **THEN** those spans are sent via OTLP to the endpoint configured for
  the running environment

### Requirement: HTTP Request Root Span
The system SHALL open one root span for every incoming HTTP request,
independent of any deeper spans produced while handling it.

#### Scenario: Every HTTP request produces a root span
- **WHEN** a client sends any HTTP request to the API
- **THEN** a root span is created covering that request's handling

### Requirement: Authenticated User Context on Spans
When a request is authenticated, the system SHALL attach the requesting
user's id to that request's trace as a span attribute.

#### Scenario: Authenticated request's span carries the user id
- **WHEN** an authenticated user's request produces a trace
- **THEN** the root span for that request includes the user's id as an
  attribute

#### Scenario: Unauthenticated request's span carries no user id
- **WHEN** an unauthenticated request (e.g. login, registration)
  produces a trace
- **THEN** the root span for that request has no user id attribute

### Requirement: Use Case Execution Span
The system SHALL produce a child span for each use case execution,
nested under the request's root span.

#### Scenario: Executing a use case produces a nested span
- **WHEN** an HTTP request results in a use case being executed
- **THEN** a span for that use case's execution appears nested under the
  request's root span

### Requirement: Data-Store Operation Span
The system SHALL produce a child span for each DynamoDB repository call
and each Redis-backed adapter call (rate limiter, token revocation
store, product list cache) made while handling a traced request.

#### Scenario: A repository call produces a nested span
- **WHEN** a traced request causes a DynamoDB repository method to run
- **THEN** a span for that call appears nested under the current trace

#### Scenario: A Redis-backed adapter call produces a nested span
- **WHEN** a traced request causes a call to the rate limiter, token
  revocation store, or product list cache
- **THEN** a span for that call appears nested under the current trace

### Requirement: No-Op Outside an Active Trace
Methods instrumented for tracing SHALL execute with unchanged behavior
and no error when called outside any active trace context (e.g., from a
unit test constructing the class directly).

#### Scenario: Instrumented method works with no active trace
- **WHEN** an instrumented method is called without any trace context
  active (no root span was ever opened)
- **THEN** the method executes and returns its normal result, producing
  no span and requiring no trace-related setup from the caller

### Requirement: Resilience to Collector Unavailability
If the trace collector is unreachable, the system SHALL continue serving
requests normally rather than failing or measurably delaying them.

#### Scenario: Requests succeed when the collector is down
- **WHEN** the configured trace collector cannot be reached
- **THEN** the system still completes the request successfully, without
  the client observing a failure or a blocking delay caused by tracing
