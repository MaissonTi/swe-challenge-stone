# Rate-limit demo (k6)

A local script to show the rate-limit working in practice, without
having to read code or test output — meant to be run in front of
someone.

Not a load/performance test: it fires login requests deliberately fast
until it exceeds the configured limit (5 req/60s, see
`openspec/specs/rate-limit/spec.md`) and shows the response flipping to
`429 Too Many Requests` with a `Retry-After` header.

## Prerequisites

- [k6](https://k6.io/docs/get-started/installation/) installed
- The API running locally (`npm run dev`, see the main README)

## How to run

```bash
k6 run k6/rate-limit-demo.js
```

To point at an API on a different host/port:

```bash
BASE_URL=http://localhost:3000 k6 run k6/rate-limit-demo.js
```

## What to expect

One line per request, `status=401` (wrong password, on purpose — this
isn't about actually authenticating) up to the 6th attempt within the
60s window, when it flips to `status=429` with
`retry-after=<seconds>s`. The summary at the end repeats the
configured limit and how many requests were fired.
