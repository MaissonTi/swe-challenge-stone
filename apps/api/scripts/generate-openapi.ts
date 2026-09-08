/* eslint-disable no-console */
import 'dotenv/config';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { patchNestJsSwagger } from 'nestjs-zod';
import { AppModule } from '../src/app.module';
import { buildOpenApiDocument } from '../src/infra/swagger/swagger.config';

/**
 * Generates apps/api/openapi.json from the controllers' decorators -
 * the same document served at /docs, but as a versioned artifact
 * reviewable without spinning up the whole stack. Doesn't start an
 * HTTP server or the tracing SDK; just instantiates the DI container
 * for SwaggerModule to inspect the routes.
 */
async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  patchNestJsSwagger();

  const document = buildOpenApiDocument(app);
  const outPath = join(process.cwd(), 'openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2) + '\n', 'utf8');

  await app.close();
  console.log(`Wrote ${outPath}`);
  // The ioredis client keeps a reconnect timer alive; exit explicitly.
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
