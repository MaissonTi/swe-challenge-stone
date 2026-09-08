## 1. Module structure

- [x] 1.1 Create `terraform/` at the repo root (outside `apps/`)
- [x] 1.2 `terraform/versions.tf`: `required_providers` (AWS, pinned
      version) and Terraform's `required_version`
- [x] 1.3 `terraform/provider.tf`: AWS provider, region via variable,
      `default_tags` (environment, project)
- [x] 1.4 `terraform/backend.tf`: explicit local backend, with a
      comment pointing at the S3+DynamoDB-lock backend as a future
      evolution (see `design.md` — Decisions)
- [x] 1.5 `terraform/variables.tf`: `aws_region`, `environment`
      (default `dev`), `users_table_name`, `products_table_name`
      (defaults derived from `environment`)

## 2. `Users` table

- [x] 2.1 `terraform/dynamodb_users.tf`: `aws_dynamodb_table` with
      partition key `email` (type `S`), on-demand billing mode
      (`PAY_PER_REQUEST` — no provisioned capacity to manage)
- [x] 2.2 `userId` attribute (type `S`) declared for the GSI
- [x] 2.3 GSI `byUserId`: partition key `userId`, `ALL` projection
      (same name used in
      `apps/api/src/infra/database/dynamodb/tables/users.table.ts`,
      `USERS_GSI1_NAME`)

## 3. `Products` table

- [x] 3.1 `terraform/dynamodb_products.tf`: `aws_dynamodb_table` with
      partition key `productId` (type `S`), on-demand billing mode
- [x] 3.2 `gsi1pk`, `gsi2pk`, `nameSortKey` attributes (all type `S`)
      declared for the GSIs
- [x] 3.3 GSI `byCategoryActive`: partition key `gsi1pk`, sort key
      `nameSortKey`, `ALL` projection (same name used in
      `products.table.ts`, `PRODUCTS_GSI1_NAME`)
- [x] 3.4 GSI `byActive`: partition key `gsi2pk`, sort key
      `nameSortKey`, `ALL` projection (`PRODUCTS_GSI2_NAME`)

## 4. API IAM access (least privilege)

- [x] 4.1 `terraform/iam.tf`: `aws_iam_role` for the API (neutral trust
      policy, not tied to a specific compute choice — e.g. a
      documented placeholder `Principal` until the compute decision is
      made)
- [x] 4.2 `aws_iam_policy` with `GetItem`/`PutItem`/`UpdateItem`/
      `DeleteItem`/`Query` restricted to the ARNs of both tables and
      **all** of their indexes (`arn:...:table/Name` and
      `arn:...:table/Name/index/*`) — no `Scan`, no `*` in `Resource`
- [x] 4.3 `aws_iam_role_policy_attachment` linking the policy to the
      role

## 5. Outputs

- [x] 5.1 `terraform/outputs.tf`: `Users` table name and ARN,
      `Products` table name and ARN, IAM role ARN

## 6. Validation

- [x] 6.1 `terraform fmt -recursive` in `terraform/` — no diff, already
      canonically formatted
- [x] 6.2 `terraform validate` (no real AWS credentials required) —
      "Success! The configuration is valid."
- [x] 6.3 `terraform plan` to confirm the plan generates exactly the
      two tables, the three GSIs, and the expected role/policy. No AWS
      account is available in this environment (see `design.md` —
      Risks: "Real AWS credentials are required..."), so this was
      verified end-to-end (`plan` → `apply` → inspect real state →
      `destroy`) against a disposable LocalStack container with
      `dynamodb`/`iam`/`sts` enabled instead — the exact mechanism this
      project already uses for DynamoDB in dev (`docker-compose.yml`).
      `apply` produced exactly 5 resources (both tables, the policy,
      the role, the attachment); `terraform state show` on the created
      tables confirmed `byUserId` (hash `userId`), `byCategoryActive`
      (hash `gsi1pk`/range `nameSortKey`), and `byActive` (hash
      `gsi2pk`/range `nameSortKey`) all exist with the right key
      schema. Torn down afterwards (`destroy`, container removed); no
      trace left in the repo (`provider_override.tf` and local state
      used for this verification were temporary and deleted, not
      committed).
- [x] 6.4 Check side by side against `users.table.ts` and
      `products.table.ts` that attribute names, GSI names, and types
      match exactly (see `design.md` — Risks: drift risk) — confirmed:
      `email`/`userId`/`byUserId` (Users) and
      `productId`/`gsi1pk`/`gsi2pk`/`nameSortKey`/`byCategoryActive`/
      `byActive` (Products) match `USERS_GSI1_NAME`/
      `PRODUCTS_GSI1_NAME`/`PRODUCTS_GSI2_NAME` and every `ProductItem`/
      `UserItem` field used as a key, exactly

## 7. Documentation

- [x] 7.1 `terraform/README.md`: how to run `init`/`plan`/`apply`
      locally, required credentials, and the relationship with the dev
      environment (LocalStack via `docker-compose` remains the
      day-to-day workflow; this Terraform targets real AWS)
- [x] 7.2 Update `FEAT.md` section 10, removing Terraform/AWS infra
      from the list of out-of-scope items, pointing to
      `terraform/README.md` — also added a new section 14 documenting
      this change's rationale, and updated the top "Decision
      summary" to match
- [x] 7.3 Update the root `README.md`: remove Terraform from the "Out
      of scope for this stage" list and add a section/line referencing
      `terraform/README.md` — also added it to "Additional
      documentation"
