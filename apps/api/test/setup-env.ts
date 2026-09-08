// Loaded via Jest's `setupFiles` for the e2e and integration tiers - these
// spin up the app (or an adapter) directly via Test.createTestingModule /
// `new SomeAdapter(...)`, never going through `main.ts`, so the
// `import 'dotenv/config'` there never runs for them. Without this, env
// vars like DYNAMODB_ENDPOINT fall back to "undefined" and the AWS SDK
// tries to reach real AWS instead of the local Docker Compose stack.
import 'dotenv/config';
