## Why

The challenge brief lists Terraform as a **mandatory technical
requirement** ("Utilizar Terraform para construção da Infraestrutura")
and "understanding and use of cloud infrastructure" as one of the
evaluation criteria — not as an optional architecture decision.
`FEAT.md` (section 10) filed this under "out of scope for this stage,
deferred decision" alongside items that genuinely are optional (CI/CD,
DAX, full-text search). That categorization doesn't hold up against the
original brief: the repo today has zero `.tf` files, leaving a
explicitly-named requirement with no corresponding code.

The DynamoDB table schema already exists and is implemented (against
LocalStack) and documented in `FEAT.md` section 11 — what's missing is
expressing it as real, provisionable infrastructure against actual AWS.

## What Changes

- New `terraform/` directory at the monorepo root (outside `apps/`,
  same rationale as `packages/common`: not a deployable, it's shared
  infrastructure).
- AWS provider configured, with region and tags (environment, project)
  via variables.
- DynamoDB table `Users`: primary key `email`, GSI `byUserId` — schema
  already defined in `FEAT.md` section 11.
- DynamoDB table `Products`: primary key `productId`, GSIs
  `byCategoryActive` (`gsi1pk` = category#active, sort key
  `nameSortKey`) and `byActive` (`gsi2pk` = active, same sort key) —
  schema already defined in `FEAT.md` section 11.
- Minimal (least-privilege) IAM role + policy for the API's access to
  both tables and their indexes: `GetItem`/`PutItem`/`UpdateItem`/
  `DeleteItem`/`Query` — no `Scan`, no access to any other resource.
- `variables.tf` (region, environment, table names) and `outputs.tf`
  (table ARNs/names, role ARN) — basic market-standard Terraform module
  practice.
- Local state backend by default; remote backend (S3 + DynamoDB lock)
  documented as a future evolution, not implemented at this stage (see
  `design.md` for the rationale for not forcing this now).
- Module `README.md` explaining `terraform init/plan/apply` and the
  relationship with the local environment (LocalStack via
  `docker-compose` remains the dev workflow; this Terraform targets
  real AWS).
- Update `FEAT.md` (section 10) and the root `README.md` to remove
  Terraform/AWS infra from the list of deferred items, since that's no
  longer accurate.

**Out of scope for this change** (remain deferred, and unlike
Terraform, are not requirements named in the brief):

- Production compute (ECS/Fargate/App Runner/Lambda) and networking
  (VPC, ALB, security groups) — where/how the API runs remains a
  deferred decision.
- CI/CD to apply Terraform automatically.
- A working S3+DynamoDB-lock remote backend (only documented/prepared).

## Capabilities

### New Capabilities

- `cloud-infra`: provisioning of the DynamoDB tables (`Users`,
  `Products`, with their GSIs) and the API's IAM access role, via
  Terraform, against real AWS.

### Modified Capabilities

(none — this is a purely infrastructure addition; no observable
behavior of `user-auth`, `products`, `rate-limit`, `web-spa`, or
`observability` changes. The application keeps running against
LocalStack in local dev, with no code changes in `apps/api`.)

## Impact

- New `terraform/` directory at the repo root — no code in `apps/api`
  or `apps/web` is changed.
- No change to runtime behavior, API contract, or existing tests.
- `FEAT.md` (section 10) and the root `README.md` updated to reflect
  that Terraform/AWS infra is no longer out of scope.
- New tooling dependency for whoever applies the infra: Terraform CLI
  and valid AWS credentials (not required to run the application
  locally, which still runs via LocalStack/Docker Compose).
