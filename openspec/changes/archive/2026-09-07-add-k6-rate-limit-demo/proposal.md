## Why

The rate-limit behavior (sliding window, `429` + `Retry-After`) is
covered by unit/e2e tests, but there is no easy, visual way to
demonstrate it live to a reviewer/recruiter without reading code or
test output.

## What Changes

- Add a local k6 script (`k6/rate-limit-demo.js`) that repeatedly hits
  `POST /v1/auth/login` past the configured limit (5 req/60s) and prints
  a clear pass/fail summary (request count, `429`s observed,
  `Retry-After` value) — meant to be run manually in front of someone,
  not as part of CI or the test suite.
- Document how to run it (prerequisites: API running locally, k6
  installed) in a short README under `k6/` or in the main README's
  tooling section.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none — this exercises existing, already-specified rate-limit behavior;
it changes no requirement)

## Impact

- New `k6/` directory (script + short README), no application code
  changes.
- No CI integration (explicitly out of scope — local demo tool only).
