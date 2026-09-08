data "aws_caller_identity" "current" {}

# Trust policy is intentionally neutral: this project defers the choice of
# production compute (ECS/Fargate, Lambda, App Runner, EC2...) - see
# design.md, "Non-Goals". Trusting the account root lets this role exist,
# be inspected, and be attached manually/tested today without presupposing
# a specific compute service. Replace the `principals` block below with
# the actual compute identity (e.g. an ECS task role, a Lambda execution
# role) once that decision is made.
data "aws_iam_policy_document" "api_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
  }
}

resource "aws_iam_role" "api" {
  name               = "${var.environment}-swe-challenge-stone-api"
  assume_role_policy = data.aws_iam_policy_document.api_assume_role.json
}

# Least privilege by action (only the item-level operations the API's
# repositories actually use - no Scan) and by resource (only these two
# tables and their indexes - see design.md, "Dedicated per-environment IAM
# role, least privilege by action").
data "aws_iam_policy_document" "api_dynamodb_access" {
  statement {
    sid    = "UsersAndProductsItemAccess"
    effect = "Allow"

    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
    ]

    resources = [
      aws_dynamodb_table.users.arn,
      "${aws_dynamodb_table.users.arn}/index/*",
      aws_dynamodb_table.products.arn,
      "${aws_dynamodb_table.products.arn}/index/*",
    ]
  }
}

resource "aws_iam_policy" "api_dynamodb_access" {
  name   = "${var.environment}-swe-challenge-stone-api-dynamodb-access"
  policy = data.aws_iam_policy_document.api_dynamodb_access.json
}

resource "aws_iam_role_policy_attachment" "api_dynamodb_access" {
  role       = aws_iam_role.api.name
  policy_arn = aws_iam_policy.api_dynamodb_access.arn
}
