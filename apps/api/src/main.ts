import 'dotenv/config';
// Start the OpenTelemetry SDK before the application starts serving.
// Import order no longer matters (no auto-instrumentation patches
// `require()` anymore) - see the design.md on the
// refine-observability-and-web-fixes change.
import './observability/tracing-setup';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { patchNestJsSwagger } from 'nestjs-zod';
import { AppModule } from './app.module';
import { setupSwagger } from './infra/swagger/swagger.config';
import { ZodValidationPipe } from './infra/validation/zod-validation-pipe';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Number of trusted reverse-proxy hops - see env.ts
  // (TRUST_PROXY_HOPS) and fix-rate-limit-trust-proxy's design.md for
  // the rationale. Must come before any route starts serving.
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 0));

  app.enableCors();
  app.useGlobalPipes(new ZodValidationPipe());
  patchNestJsSwagger();
  setupSwagger(app);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap();
