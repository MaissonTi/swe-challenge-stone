import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { ZodValidationPipe } from '@/infra/validation/zod-validation-pipe';

export type CreateTestAppOptions = {
  /**
   * Mirrors main.ts's `app.set('trust proxy', ...)` (see env.ts's
   * TRUST_PROXY_HOPS and fix-rate-limit-trust-proxy's design.md).
   * Defaults to 0 (trust no proxy) - same as every other e2e test and as
   * the app's own default - so only a test that specifically exercises
   * the trust-proxy mechanism needs to pass this.
   */
  trustProxyHops?: number;
};

/**
 * Mirrors main.ts's bootstrap() setup that matters for e2e assertions -
 * without the global ZodValidationPipe, DTO validation never runs and
 * every "invalid input -> 400" test would silently pass through instead.
 * The `/v1` route prefix lives on the controllers themselves, so nothing
 * extra is needed here for it.
 */
export async function createTestApp({
  trustProxyHops = 0,
}: CreateTestAppOptions = {}): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  app.set('trust proxy', trustProxyHops);
  app.useGlobalPipes(new ZodValidationPipe());
  await app.init();
  return app;
}
