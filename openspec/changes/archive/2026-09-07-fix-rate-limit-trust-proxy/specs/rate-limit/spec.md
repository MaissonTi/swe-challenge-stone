## MODIFIED Requirements

### Requirement: Per-Identity Rate Limit Key
The system SHALL key rate-limit counters by the authenticated user's
identity on authenticated routes, and by client IP address on
unauthenticated routes. When the application is deployed behind a
trusted reverse proxy or load balancer, the client IP address used for
keying SHALL be the real originating client address, not the address of
the proxy itself.

#### Scenario: Authenticated requests limited per user
- **WHEN** an authenticated user sends multiple requests to a protected
  route
- **THEN** the rate limit is tracked against that user's identity,
  independent of other users sharing the same IP address

#### Scenario: Anonymous requests limited per IP
- **WHEN** an unauthenticated client sends multiple requests to a public
  route such as login
- **THEN** the rate limit is tracked against the client's IP address

#### Scenario: Anonymous requests behind a trusted reverse proxy are keyed by real client IP
- **WHEN** the application is configured to trust a reverse proxy and an
  unauthenticated request arrives via that proxy, carrying the client's
  real IP in the forwarded-for header
- **THEN** the rate limit is tracked against the real client IP from the
  forwarded-for header, so that two different clients behind the same
  proxy are tracked independently rather than sharing one bucket
