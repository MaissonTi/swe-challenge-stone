## Purpose

Protects the API from abusive or excessive request volume by enforcing
per-route, per-identity request limits implemented within the
application itself, without relying on a managed external service.

## ADDED Requirements

### Requirement: Application-Implemented Rate Limiting
The system SHALL enforce request rate limits within the application
itself, using a shared, centralized counter store, rather than relying
on per-instance in-memory counters or delegating enforcement to an
external managed service.

#### Scenario: Limit enforced consistently across multiple instances
- **WHEN** requests attributed to the same rate-limit key arrive at
  different running instances of the application
- **THEN** the combined request count across all instances is subject to
  the same shared limit, as if served by a single instance

### Requirement: Continuous (Sliding) Rate Limit Window
The system SHALL evaluate request rate over a continuously moving time
window rather than a fixed window that resets abruptly, to prevent a
client from exceeding the intended rate by concentrating requests around
a window boundary.

#### Scenario: Requests spread across a window boundary remain limited
- **WHEN** a client sends requests that straddle what would be a
  fixed-window reset boundary, at a rate that would exceed the limit if
  the window resets were exploited
- **THEN** the system still enforces the configured limit across that
  boundary, rather than allowing roughly double the limit

### Requirement: Per-Identity Rate Limit Key
The system SHALL key rate-limit counters by the authenticated user's
identity on authenticated routes, and by client IP address on
unauthenticated routes.

#### Scenario: Authenticated requests limited per user
- **WHEN** an authenticated user sends multiple requests to a protected
  route
- **THEN** the rate limit is tracked against that user's identity,
  independent of other users sharing the same IP address

#### Scenario: Anonymous requests limited per IP
- **WHEN** an unauthenticated client sends multiple requests to a public
  route such as login
- **THEN** the rate limit is tracked against the client's IP address

### Requirement: Configurable Per-Route Limits
The system SHALL support configuring a different rate limit threshold
and window per route, so that sensitive routes (such as login) can be
limited more strictly than others.

#### Scenario: Login route enforces a stricter limit than listing
- **WHEN** the login route and the product listing route each have their
  own configured limit
- **THEN** exceeding the login route's limit does not depend on the
  product listing route's limit, and vice versa

### Requirement: Rate Limit Exceeded Response
When a client exceeds the configured rate limit for a route, the system
SHALL reject the request with a `429 Too Many Requests` response and
SHALL indicate how long the client should wait before retrying.

#### Scenario: Exceeding the limit returns 429 with retry information
- **WHEN** a client exceeds the configured limit for a rate-limited route
- **THEN** the system responds with status `429` and a `Retry-After`
  header indicating when the client may retry

### Requirement: Resilience to Rate-Limit Store Unavailability
If the underlying rate-limit counter store is unavailable, the system
SHALL fail open (allow the request through) rather than reject all
requests, and SHALL log the degraded condition.

#### Scenario: Rate-limit store unavailable does not block requests
- **WHEN** the rate-limit counter store cannot be reached within a short
  timeout
- **THEN** the system allows the request to proceed without enforcing
  the rate limit, and logs a warning about the degraded state
