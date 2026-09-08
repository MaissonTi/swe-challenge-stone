# Schema mirrors
# apps/api/src/infra/database/dynamodb/tables/products.table.ts
# (PRODUCTS_GSI1_NAME / PRODUCTS_GSI2_NAME):
#
# - byCategoryActive: partitioned by (category, active), sorted by name.
#   Used when a category filter is present (with or without a name prefix).
# - byActive: partitioned by active status only, covering the whole
#   catalog, sorted by name. Used when there is no category filter.
#
# Baking `active` into both GSI partition keys means "only active
# products" never needs a FilterExpression - inactive items are simply
# never in the queried partition. Keep this file in sync with the code
# above - see design.md, "Risks: drift".
resource "aws_dynamodb_table" "products" {
  name         = local.products_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "productId"

  attribute {
    name = "productId"
    type = "S"
  }

  attribute {
    name = "gsi1pk"
    type = "S"
  }

  attribute {
    name = "gsi2pk"
    type = "S"
  }

  attribute {
    name = "nameSortKey"
    type = "S"
  }

  global_secondary_index {
    name            = "byCategoryActive"
    hash_key        = "gsi1pk"
    range_key       = "nameSortKey"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "byActive"
    hash_key        = "gsi2pk"
    range_key       = "nameSortKey"
    projection_type = "ALL"
  }
}
