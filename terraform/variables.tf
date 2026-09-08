variable "aws_region" {
  description = "AWS region to provision resources in."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment name. Used to namespace resource names (unless overridden) and applied as a tag on every resource - e.g. \"dev\", \"staging\", \"prod\"."
  type        = string
  default     = "dev"
}

variable "users_table_name" {
  description = "Name of the DynamoDB Users table. Defaults to \"<environment>-Users\" when not set."
  type        = string
  default     = null
}

variable "products_table_name" {
  description = "Name of the DynamoDB Products table. Defaults to \"<environment>-Products\" when not set."
  type        = string
  default     = null
}
