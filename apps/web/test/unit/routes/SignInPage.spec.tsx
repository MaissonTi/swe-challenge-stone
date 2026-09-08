import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SignInPage } from '@/routes/auth/SignInPage';

const signIn = vi.fn();

vi.mock('@/providers/AuthProvider', () => ({
  useAuth: () => ({
    signIn,
    signOut: vi.fn(),
    status: 'unauthenticated',
    user: null,
  }),
}));

describe('SignInPage', () => {
  it('blocks submission and does not call signIn when the fields are empty', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(signIn).not.toHaveBeenCalled();
    });
  });

  it('calls signIn with the entered credentials once the form is valid', async () => {
    const user = userEvent.setup();
    signIn.mockResolvedValueOnce(undefined);
    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'Password1',
      });
    });
  });
});
