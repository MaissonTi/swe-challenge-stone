// Local demo of the rate-limit in action. Not a load/performance test -
// fires more requests than the configured limit for
// POST /v1/auth/login (5 req/60s, see auth.controller.ts and
// openspec/specs/rate-limit/spec.md) and shows the transition from
// 401 (invalid credential, expected - the goal here isn't to actually
// log in) to 429 (Too Many Requests) right on screen.
//
// Usage: k6 run k6/rate-limit-demo.js
// (the API must be running at http://localhost:3000 - see README)
import http from 'k6/http';
import { sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const LOGIN_LIMIT = 5; // must match @RateLimit on POST /v1/auth/login
const REQUESTS = LOGIN_LIMIT + 5; // margin to make the 429 clearly visible

export const options = {
  vus: 1,
  iterations: REQUESTS,
};

export default function () {
  const res = http.post(
    `${BASE_URL}/v1/auth/login`,
    JSON.stringify({ email: 'demo@stone.com.br', password: 'deliberately-wrong-password' }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  const retryAfter = res.headers['Retry-After'];
  const marker = res.status === 429 ? '  <-- rate limit triggered' : '';
  console.log(
    `iter ${__ITER + 1}/${REQUESTS}: status=${res.status}` +
      (retryAfter ? ` retry-after=${retryAfter}s` : '') +
      marker,
  );

  sleep(0.2);
}

export function handleSummary() {
  return {
    stdout:
      '\n=== Summary ===\n' +
      `Configured limit (login): ${LOGIN_LIMIT} req / 60s\n` +
      `Requests fired: ${REQUESTS}\n` +
      'See above where status flips from 401 to 429 - that is the\n' +
      'rate-limit kicking in once the limit is reached.\n',
  };
}
