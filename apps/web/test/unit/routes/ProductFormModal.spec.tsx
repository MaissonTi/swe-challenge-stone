import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProductFormModal } from '@/routes/products/ProductFormModal';

vi.mock('@/services/products.service', () => ({
  productsService: {
    create: vi.fn(),
    update: vi.fn(),
  },
}));

// Opening/selecting from the Radix Select (category field) needs real
// PointerEvent behavior that jsdom doesn't reliably provide - that
// interaction is covered instead by the Playwright e2e suite (real
// browser), which is exactly the "invalid category blocked client-side"
// scenario in specs/web-spa. This file covers what jsdom tests reliably:
// the schema-level requirement that both fields be present before submit.
function renderModal() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/products/new']}>
        <ProductFormModal />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProductFormModal', () => {
  it('blocks submission when the name is empty, without calling the API', async () => {
    const { productsService } = await import('@/services/products.service');
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(productsService.create).not.toHaveBeenCalled();
    });
  });

  it('leaves the category unselected by default, requiring an explicit choice', () => {
    renderModal();

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('Select a category');
  });
});
