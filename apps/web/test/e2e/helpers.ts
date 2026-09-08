export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@stone.com.br`;
}

export function uniqueProductName(): string {
  return `E2E Product ${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
