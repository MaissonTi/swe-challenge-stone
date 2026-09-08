#!/usr/bin/env bash
# Generates a dev-only RS256 key pair for signing JWTs.
# Keys are gitignored (see .gitignore) - never commit them.
set -euo pipefail

KEYS_DIR="$(dirname "$0")/../keys"
mkdir -p "$KEYS_DIR"

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$KEYS_DIR/private.pem"
openssl rsa -pubout -in "$KEYS_DIR/private.pem" -out "$KEYS_DIR/public.pem"

echo "Generated $KEYS_DIR/private.pem and $KEYS_DIR/public.pem"
