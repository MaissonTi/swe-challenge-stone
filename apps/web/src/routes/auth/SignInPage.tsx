import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { loginSchema, type LoginInput } from '@swe-challenge-stone/common';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/providers/AuthProvider';

export function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [authError, setAuthError] = React.useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginInput) {
    setAuthError(null);
    try {
      await signIn(values);
      navigate('/products', { replace: true });
    } catch (err) {
      // Same generic message regardless of cause - don't reveal whether
      // the e-mail exists (see specs/user-auth).
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setAuthError('Invalid email or password.');
      } else {
        setAuthError('Unable to sign in. Please try again.');
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Sign in to your account to view the catalog.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {authError && (
              <p className="text-sm font-medium text-destructive">
                {authError}
              </p>
            )}
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="w-full"
            >
              Sign in
            </Button>
          </form>
        </Form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link
            to="/auth/signup"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
