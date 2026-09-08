import { z } from 'zod';

/**
 * Shared between apps/api (registration DTO) and apps/web (sign-up form),
 * so the password policy can't drift between server and client.
 */
export const passwordPolicySchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/^\S+$/, 'Password must not contain whitespace');

export const registerSchema = z.object({
  email: z.string().email(),
  password: passwordPolicySchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
