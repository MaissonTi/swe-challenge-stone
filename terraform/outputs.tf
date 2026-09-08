output "users_table_name" {
  description = "Name of the DynamoDB Users table."
  value       = aws_dynamodb_table.users.name
}

output "users_table_arn" {
  description = "ARN of the DynamoDB Users table."
  value       = aws_dynamodb_table.users.arn
}

output "products_table_name" {
  description = "Name of the DynamoDB Products table."
  value       = aws_dynamodb_table.products.name
}

output "products_table_arn" {
  description = "ARN of the DynamoDB Products table."
  value       = aws_dynamodb_table.products.arn
}

output "api_role_arn" {
  description = "ARN of the IAM role granting the API access to the Users/Products tables."
  value       = aws_iam_role.api.arn
}
