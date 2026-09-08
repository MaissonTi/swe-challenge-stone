## 1. Env var

- [x] 1.1 `apps/api/src/infra/env/env.ts`: add
      `TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0)` to
      `envSchema`, with a comment explaining `0` = trust no proxy
      (today's actual deployment) and pointing at the compute/network
      roadmap for when to change it
- [x] 1.2 `apps/api/.env.example`: add `TRUST_PROXY_HOPS=0` with the
      same explanatory comment

## 2. Bootstrap

- [x] 2.1 `apps/api/src/main.ts`: change
      `NestFactory.create(AppModule)` to
      `NestFactory.create<NestExpressApplication>(AppModule)` (import
      `NestExpressApplication` from `@nestjs/platform-express`)
- [x] 2.2 Right after creating `app`, call
      `app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 0))`
      - before `app.enableCors()`/`app.listen()`, same direct-env-read
      style already used for `PORT` in this file

## 3. Test app factory

- [x] 3.1 `apps/api/test/e2e/helpers/create-test-app.ts`: allow the
      caller to pass a trust-proxy hop count (e.g., an optional
      parameter), applying it the same way as `main.ts` (type the app
      as `NestExpressApplication` or reach through
      `app.getHttpAdapter().getInstance()`) so a test can opt in without
      changing the default for every other e2e test

## 4. Test proving the mechanism

- [x] 4.1 New e2e test (rate-limit e2e spec): with the test app created
      with `TRUST_PROXY_HOPS`-equivalent hops = 1, send two requests to
      an anonymous rate-limited route (e.g. login) with two different
      `X-Forwarded-For` header values, at a volume that would exceed the
      route's limit if they shared one bucket; assert neither request is
      throttled by the other's count
- [x] 4.2 Same test file: with hops = 0 (or the app created via the
      factory's existing default), confirm two requests with different
      `X-Forwarded-For` values *do* share a bucket (today's behavior is
      unchanged when trust proxy is off) - guards against silently
      changing default behavior

## 5. Documentation

- [x] 5.1 `docs/PRD.md` (rate-limit section): document the
      `TRUST_PROXY_HOPS` mechanism and explicitly link it to the
      existing compute/network roadmap entry - whoever provisions real
      compute must set this alongside that decision
- [x] 5.2 Confirm no other doc (e.g. `terraform/README.md`,
      `key_words.md`) makes a claim about rate-limit IP keying that this
      change would make stale — checked, none do

## 6. Verification

- [x] 6.1 Run the full unit + e2e suite; confirm no existing test
      (which all run with trust proxy off, i.e. hops = 0) changes
      behavior — 27/27 unit suites (119 tests), 3/3 e2e suites (18
      tests, including the 2 new ones), `nest build` clean
- [x] 6.2 Run the new test(s) from section 4 and confirm they fail
      against the pre-fix code path (temporarily) and pass after the
      fix - not just "written, assumed correct" — temporarily commented
      out `app.set('trust proxy', ...)` in `create-test-app.ts`: the
      "tracks two forwarded IPs independently" test failed exactly as
      expected (2.2.2.2 collided with 1.1.1.1's exhausted bucket);
      restored the fix, re-ran, both tests pass again
