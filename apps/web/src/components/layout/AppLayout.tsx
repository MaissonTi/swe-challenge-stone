import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers/AuthProvider';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
    isActive && 'bg-accent text-accent-foreground',
  );

export function AppLayout() {
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between">
          <nav className="flex items-center gap-1">
            <NavLink to="/products" className={navLinkClass}>
              Products
            </NavLink>
            <NavLink to="/profile" className={navLinkClass}>
              Profile
            </NavLink>
          </nav>
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm text-muted-foreground">
                {user.email}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="container flex-1 py-6">
        <Outlet />
      </main>
    </div>
  );
}
