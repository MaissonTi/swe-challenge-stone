# Schema mirrors apps/api/src/infra/database/dynamodb/tables/users.table.ts
# (USERS_GSI1_NAME) - the dominant access pattern is lookup by e-mail
# (login, uniqueness check on registration), so `email` is the primary
# key; `userId` (the JWT `sub` claim) gets its own GSI for GET /auth/me.
# Keep the two files in sync - see design.md, "Risks: drift".
resource "aws_dynamodb_table" "users" {
  name         = local.users_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "email"

  attribute {
    name = "email"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  global_secondary_index {
    name            = "byUserId"
    hash_key        = "userId"
    projection_type = "ALL"
  }
}
