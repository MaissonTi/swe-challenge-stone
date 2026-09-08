# Terraform — Cloud Infrastructure

Provisions the AWS resources this API's persistence layer needs against
**real AWS**: the `Users`/`Products` DynamoDB tables and a least-privilege
IAM role for the API to access them. Schema, decisions, and rationale are
documented in [`../docs/PRD.md`](../docs/PRD.md) (§4.1.4 and §5) and in
this change's [`design.md`](../openspec/changes/add-terraform-infra/design.md).

**This is not what local development uses.** Day-to-day dev keeps running
against LocalStack via the root `docker-compose.yml`
(`npm run bootstrap:localstack --workspace=apps/api`) — no AWS account or
credentials needed for that. This module exists to satisfy the actual
requirement of provisioning real cloud infrastructure, and to let anyone
review/`plan` it without needing to run the whole application.

## What this provisions

- DynamoDB table `<environment>-Users` — primary key `email`, GSI
  `byUserId`.
- DynamoDB table `<environment>-Products` — primary key `productId`, GSIs
  `byCategoryActive` and `byActive`.
- An IAM role + policy scoped to `GetItem`/`PutItem`/`UpdateItem`/
  `DeleteItem`/`Query` on those two tables and their indexes only (no
  `Scan`, no other resource).

## Out of scope (see `design.md` — Non-Goals)

Production compute (ECS/Fargate/App Runner/Lambda) and networking are not
provisioned here — where/how the API runs is a deferred decision, unlike
this persistence-layer infrastructure. CI/CD to apply this automatically
is also out of scope.

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5
- An AWS account and credentials with permission to manage DynamoDB
  tables and IAM roles/policies (e.g. via `aws configure`, or the usual
  `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_SESSION_TOKEN`
  environment variables) — **only needed to actually `apply`**; `init`
  and `validate` don't require a real account.

## Usage

```bash
cd terraform

terraform init
terraform plan    # review what would be created
terraform apply   # provision against your AWS account
```

Variables (all optional — see `variables.tf` for defaults):

| Variable               | Default             | Purpose                                   |
| ---------------------- | -------------------- | ------------------------------------------ |
| `aws_region`            | `us-east-1`          | Region to provision resources in           |
| `environment`           | `dev`                | Namespaces resource names and tags them    |
| `users_table_name`      | `${environment}-Users`    | Override the Users table name         |
| `products_table_name`   | `${environment}-Products` | Override the Products table name      |

Example, targeting a different environment:

```bash
terraform apply -var="environment=staging"
```

Outputs (`terraform output` after apply): `users_table_name`,
`users_table_arn`, `products_table_name`, `products_table_arn`,
`api_role_arn` — wire these into the application's real deployment
configuration once a compute target is chosen.

To tear everything down:

```bash
terraform destroy
```

## State

State is local (`terraform.tfstate`, gitignored) — see `main.tf` for
why, and the documented (not yet implemented) path to an S3 + DynamoDB-
lock remote backend once more than one operator needs to apply this
concurrently.

## Keeping this in sync with the application code

The table schema here **must** match
[`apps/api/src/infra/database/dynamodb/tables/users.table.ts`](../apps/api/src/infra/database/dynamodb/tables/users.table.ts)
and
[`products.table.ts`](../apps/api/src/infra/database/dynamodb/tables/products.table.ts)
exactly — attribute names, GSI names, key schema. If you change one, change
the other in the same commit.
