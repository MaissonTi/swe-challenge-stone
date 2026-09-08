# Integration tests

Tests that hit **real local** DynamoDB/Redis (via Docker Compose /
LocalStack), without going through the HTTP layer — e.g. a repository
under `infra/database/dynamodb/` writing to and reading from a real
table.

Naming convention: `*.integration-spec.ts` (see
`test/jest-integration.json`).

Requires the local stack to be up (`docker compose up`) before running
`npm run test:integration`.
