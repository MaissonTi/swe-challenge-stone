// Explicit named re-exports rather than `export *`: the latter compiles
// (under this package's CommonJS target) to a runtime __exportStar loop
// that Rollup's static CJS-interop analysis can't see through, which
// breaks named imports (`import { loginSchema } from '...'`) from
// apps/web's Vite/Rollup build while working fine from apps/api's
// ts-node/CommonJS runtime.
export {
  productCategorySchema,
  createProductSchema,
  updateProductSchema,
  type ProductCategory,
  type CreateProductInput,
  type UpdateProductInput,
} from './schemas/product.schema';

export {
  passwordPolicySchema,
  registerSchema,
  loginSchema,
  type RegisterInput,
  type LoginInput,
} from './schemas/auth.schema';
