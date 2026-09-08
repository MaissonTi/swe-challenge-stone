## Context

The table schema already exists and is implemented against LocalStack —
see `apps/api/src/infra/database/dynamodb/tables/users.table.ts` and
`products.table.ts`, and the modeling rationale in `FEAT.md` section 11.
This change does not design a new schema: it translates an
already-validated local schema into a Terraform module that provisions
the same design against real AWS. See `proposal.md` for why this change
exists now (a requirement named in the brief, with no corresponding
code today).

## Goals / Non-Goals

**Goals:**
- Make the two DynamoDB tables (`Users`, `Products`) and the API's IAM
  access to them provisionable via real `terraform plan`/`apply`.
- Keep schema parity with what already runs against LocalStack — no
  data migration, no code change in `apps/api`.
- Follow basic market-standard practices for a Terraform module: input
  variables, outputs, tags, environment-parameterized names.

**Non-Goals:**
- Does not decide where/how the API runs in production (compute,
  networking, load balancer) — that remains a deferred decision, and
  unlike Terraform is not a requirement named in the brief.
- Does not implement a working remote state backend (S3 + DynamoDB
  lock) — only documents that path.
- Does not replace LocalStack in the local dev workflow — dev keeps
  running via `docker-compose`, without depending on real AWS
  credentials.
- Does not cover CI/CD to apply Terraform automatically.

## Decisions

### Location: `terraform/` at the root, outside `apps/`
Same rationale already used for `packages/common` (see `FEAT.md`
section 7): `apps/` is only for deployables; shared infrastructure that
isn't "a service that runs on its own" lives outside it. Alternative
considered: `apps/api/terraform/`, declined because the provisioned
infra (tables) isn't exclusive to the API in a deployment sense — it's
a data resource that could, in principle, be consumed by another
service later (e.g. a worker), so it shouldn't be coupled to a single
deployable's folder.

### Two separate tables, not single-table design
Already decided in `FEAT.md` section 3.4 for the application; this
change only translates that decision into Terraform. No new trade-off
here.

### Dedicated per-environment IAM role, least privilege by action (not by condition)
The policy restricts by **action** (`GetItem`/`PutItem`/`UpdateItem`/
`DeleteItem`/`Query`, no `Scan`) and by **resource** (the ARNs of the
two tables and their indexes, nothing else). Alternative considered:
a policy using `dynamodb:LeadingKeys` (row-level security), declined
because there's no tenant/ownership concept in the domain (see
`FEAT.md` section 9) — there's no row-level condition to restrict,
isolation is already total since no other consumer touches the table.

### Local state by default, remote backend documented as an evolution
A working S3+DynamoDB-lock backend requires provisioning (manually, in
a prior bootstrap step, or in another module) the bucket/lock table
itself before state exists for them — a bootstrapping problem
("infra to manage infra") disproportionate to this challenge's scope,
which has no multiple operators applying Terraform concurrently (the
scenario a remote backend solves). Documented in the module's
`README.md` as the natural next step, not implemented now. Accepted
risk: local state isn't shareable across machines — acceptable because
this is an evaluation project, not a team operating the infra together.

### Parameterized table/role names, without pre-built multi-environment `.tfvars` files
A single environment variable (e.g. `environment`, default `dev`)
composes resource names (e.g. `${var.environment}-Users`). This
satisfies the "environment-parameterized" requirement (see spec)
without having to decide a full multi-environment strategy now
(Terraform workspaces vs. per-environment directories vs. per-
environment `.tfvars`) — that's an operational decision, not minimal
infrastructure, and stays out of scope for this change.

## Risks / Trade-offs

- **[Risk]** Drift between the Terraform schema and the schema actually
  used by the application's code (`users.table.ts`/`products.table.ts`)
  if one changes without the other.
  → **Mitigation**: `tasks.md` includes checking both files side by
  side before considering the change done; the module's `README.md`
  makes explicit that any schema change in code must be reflected here.
- **[Risk]** Real AWS credentials are required for a genuine `terraform
  apply`/`plan`, which isn't exercisable in CI/an evaluation
  environment without an AWS account.
  → **Mitigation**: actually running `apply` is not a goal of this
  change — the reviewable deliverable is the correctness of the
  configuration and `terraform validate`/`plan` (which don't require
  an account with write permission, just valid credentials, or a plan
  scoped with `-target`). This is documented clearly in the module's
  `README.md`.
- **[Trade-off]** Local state isn't shareable or version-controlled.
  → Accepted deliberately (see Decisions above); documented as an
  evolution, not an overlooked gap.

## Migration Plan

There's no existing data to migrate — the tables today only exist in
LocalStack (ephemeral, recreated on every `bootstrap:localstack`). This
change doesn't touch the local dev environment or require any
migration: it's the first time the tables exist as Terraform
configuration. Rollback, if needed, is `terraform destroy` in whatever
environment it was applied to.
