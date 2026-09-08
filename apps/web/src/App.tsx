import {
  Navigate,
  RouterProvider,
  createBrowserRouter,
} from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { RequireAuth } from '@/routes/RequireAuth';
import { SignInPage } from '@/routes/auth/SignInPage';
import { SignUpPage } from '@/routes/auth/SignUpPage';
import { ProductsPage } from '@/routes/products/ProductsPage';
import { ProductFormModal } from '@/routes/products/ProductFormModal';
import { ProfilePage } from '@/routes/profile/ProfilePage';

const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: '/auth/signin', element: <SignInPage /> },
      { path: '/auth/signup', element: <SignUpPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/products" replace /> },
          {
            path: 'products',
            element: <ProductsPage />,
            children: [
              { path: 'new', element: <ProductFormModal /> },
              { path: ':id/edit', element: <ProductFormModal /> },
            ],
          },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}
