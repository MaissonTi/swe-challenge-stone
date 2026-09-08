import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import {
  registerSchema,
  type RegisterInput,
} from '@swe-challenge-stone/common';
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
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/services/auth.service';

export function SignUpPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: RegisterInput) {
    setSubmitError(null);
    try {
      await authService.register(values);
      toast({
        title: 'Account created',
        description: 'Now just sign in with your email and password.',
      });
      navigate('/auth/signin', { replace: true });
    } catch {
      setSubmitError('Unable to complete registration. Please try again.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>Takes less than a minute.</CardDescription>
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
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {submitError && (
              <p className="text-sm font-medium text-destructive">
                {submitError}
              </p>
            )}
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="w-full"
            >
              Create account
            </Button>
          </form>
        </Form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            to="/auth/signin"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
