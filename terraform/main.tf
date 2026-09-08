# This file holds everything that isn't an actual infrastructure resource:
# Terraform/provider version pins, the state backend, the AWS provider
# itself, and the small locals derived from variables. Resources live in
# their own files by concern: dynamodb_users.tf, dynamodb_products.tf,
# iam.tf.

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Local backend, explicit rather than implicit (Terraform's default when
  # no `backend` block is present is also local, but spelling it out here
  # makes the choice a deliberate, visible decision instead of an
  # accident).
  #
  # State is stored on disk (terraform.tfstate, gitignored) - fine for a
  # single operator applying this module, which is this project's actual
  # scenario (an evaluation submission, not a team operating shared
  # infra). Not shareable across machines, not safe for concurrent
  # applies.
  #
  # Evolution path (not implemented here - see design.md, "Local state by
  # default, remote backend documented as an evolution"): move state to
  # an S3 bucket with a DynamoDB table for locking once more than one
  # operator needs to apply this module concurrently. That requires
  # bootstrapping the bucket/lock table themselves first (a
  # chicken-and-egg problem - you can't store this module's state in a
  # bucket this module hasn't created yet), typically via a small one-off
  # apply of a separate bootstrap module or a few manual `aws` CLI calls.
  # Once that exists, replace this block with:
  #
  # backend "s3" {
  #   bucket         = "<bootstrapped-state-bucket>"
  #   key            = "swe-challenge-stone/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "<bootstrapped-lock-table>"
  #   encrypt        = true
  # }
  backend "local" {
    path = "terraform.tfstate"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = "swe-challenge-stone"
      ManagedBy   = "terraform"
    }
  }
}

locals {
  # Applying this module twice with a different `environment` (and no
  # explicit table name override) provisions two non-colliding sets of
  # resources - see specs/cloud-infra/spec.md, "Same module provisions
  # distinct environments".
  users_table_name    = coalesce(var.users_table_name, "${var.environment}-Users")
  products_table_name = coalesce(var.products_table_name, "${var.environment}-Products")
}
