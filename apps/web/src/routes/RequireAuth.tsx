import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/providers/AuthProvider';

/**
 * Guards every authenticated-only route (see specs/web-spa: "Protected
 * Route Access"). This is UX only, not a security boundary - the API's
 * own JwtAuthGuard is what actually protects the data.
 */
export function RequireAuth() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/auth/signin" replace />;
  }

  return <Outlet />;
}
