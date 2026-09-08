# End-to-end tests

Tests that spin up the whole NestJS application and make real HTTP
requests via `supertest`, against the local stack (DynamoDB/Redis via
Docker Compose).

Naming convention: `*.e2e-spec.ts` (see `test/jest-e2e.json`).

Requires the local stack to be up (`docker compose up`) before running
`npm run test:e2e`.
