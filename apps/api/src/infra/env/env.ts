import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),

  AWS_REGION: z.string().default('us-east-1'),
  DYNAMODB_ENDPOINT: z.string().optional(),
  USERS_TABLE_NAME: z.string().default('Users'),
  PRODUCTS_TABLE_NAME: z.string().default('Products'),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_PRIVATE_KEY_PATH: z.string().default('./keys/private.pem'),
  JWT_PUBLIC_KEY_PATH: z.string().default('./keys/public.pem'),
  JWT_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().default(900),
  JWT_REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().default(604800),

  // Read directly from process.env by observability/tracing-setup.ts,
  // not via EnvService - tracing needs to start before Nest's DI
  // container exists (see design.md on the add-tracing-observability
  // change). Declared here anyway to stay documented alongside the
  // other env vars.
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://localhost:4318'),

  // Number of trusted reverse-proxy hops (Express `trust proxy`), used
  // by main.ts to resolve the real client IP from X-Forwarded-For for
  // rate-limiting anonymous routes. `0` = trust no proxy - correct
  // today (local dev, e2e, and the current real deployment, which has
  // no load balancer in front of it yet). Adjust to the real hop count
  // once the compute/network decision is made (see docs/PRD.md, cloud
  // infra roadmap) - see this change's design.md
  // (fix-rate-limit-trust-proxy) for the full rationale.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
});

export type Env = z.infer<typeof envSchema>;
