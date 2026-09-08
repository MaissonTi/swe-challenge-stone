## 1. k6 script

- [x] 1.1 Create `k6/rate-limit-demo.js` targeting `POST /v1/auth/login`,
      sending more requests than the configured limit (5/60s) and
      logging status code + `Retry-After` per request
- [x] 1.2 Add a summary line at the end (requests sent, how many
      succeeded vs. got `429`, first `Retry-After` observed)

## 2. Docs

- [x] 2.1 Add `k6/README.md`: prerequisites (k6 installed, API running
      locally), how to run (`k6 run k6/rate-limit-demo.js`), what output
      to expect
- [x] 2.2 Reference the demo script from the main README's tooling
      section

## 3. Verification

- [x] 3.1 Run the script against a locally running API and confirm it
      shows the expected transition from `200`/`204` to `429` partway
      through, with a sensible `Retry-After` — confirmed: `401` (wrong
      password, intentional — not about a real login) on requests 1–5,
      `429` with `Retry-After: 35s`/`34s` from request 6 onward
