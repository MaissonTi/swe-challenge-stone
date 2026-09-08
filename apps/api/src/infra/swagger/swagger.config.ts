import { readFileSync } from 'fs';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

// Version comes from the API's package.json, so it can't drift from a
// number hand-written here. The API always runs with cwd at apps/api
// (nest start, node dist/main.js, and the generate-openapi script).
function resolveApiVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
    ) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const version = resolveApiVersion();

const DESCRIPTION = [
  'Authentication (JWT RS256 with rotating refresh, reuse detection, and',
  'revocation via a Redis blacklist) and a protected product catalog,',
  'cursor-paginated and filterable by category and name prefix.',
  '',
  'Every route goes through a distributed rate limit (sliding window in',
  'Redis): exceeding it returns `429` with a `Retry-After` header.',
  'The rationale behind each decision is in `docs/PRD.md`.',
].join('\n');

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Stone Challenge API')
    .setDescription(DESCRIPTION)
    .setVersion(version)
    .addServer('http://localhost:3000', 'Local (dev)')
    .addTag(
      'auth',
      'Registration, login, rotating refresh, logout, and user profile',
    )
    .addTag(
      'products',
      'CRUD and paginated/filterable catalog listing (protected route)',
    )
    .addTag('health', 'Liveness check (public route)')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}

export function setupSwagger(app: INestApplication): void {
  const document = buildOpenApiDocument(app);
  SwaggerModule.setup('docs', app, document);
}
