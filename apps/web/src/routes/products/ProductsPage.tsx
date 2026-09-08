import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/composition/Pagination';
import {
  ProductFilters,
  type ProductFiltersValue,
} from '@/components/composition/ProductFilters';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { productsService } from '@/services/products.service';
import type { Product } from '@/types/api';

export function ProductsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [filters, setFilters] = React.useState<ProductFiltersValue>({});
  // Cursor stack: index 0 is always "no cursor" (first page). Moving to
  // the next page pushes the cursor the API just returned; moving back
  // just walks the stack down - the API itself has no "previous" concept
  // (see specs/products: "Paginated Listing").
  const [cursorStack, setCursorStack] = React.useState<
    Array<string | undefined>
  >([undefined]);
  const [pageIndex, setPageIndex] = React.useState(0);

  function applyFilters(next: ProductFiltersValue) {
    setFilters(next);
    setCursorStack([undefined]);
    setPageIndex(0);
  }

  const cursor = cursorStack[pageIndex];
  const { data, isLoading, isError } = useQuery({
    queryKey: ['products', filters, cursor],
    queryFn: () => productsService.list({ ...filters, cursor }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => productsService.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Product deactivated' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Product deleted' });
    },
  });

  function goToNextPage() {
    if (!data?.nextCursor) return;
    const nextStack = cursorStack.slice(0, pageIndex + 1);
    nextStack.push(data.nextCursor);
    setCursorStack(nextStack);
    setPageIndex(pageIndex + 1);
  }

  function goToPreviousPage() {
    setPageIndex((index) => Math.max(0, index - 1));
  }

  function openEdit(product: Product) {
    navigate(`/products/${product.id}/edit`, { state: { product } });
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Products</h1>
        <Button onClick={() => navigate('/products/new')}>New product</Button>
      </div>

      <ProductFilters value={filters} onChange={applyFilters} />

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {isError && (
        <p className="text-sm text-destructive">Unable to load products.</p>
      )}

      {data && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground"
                  >
                    No products found.
                  </TableCell>
                </TableRow>
              )}
              {data.items.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(product)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deactivateMutation.mutate(product.id)}
                    >
                      Deactivate
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => deleteMutation.mutate(product.id)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination
            hasPrevious={pageIndex > 0}
            hasNext={Boolean(data.nextCursor)}
            onPrevious={goToPreviousPage}
            onNext={goToNextPage}
          />
        </>
      )}

      {/* Modal routes: /products/new and /products/:id/edit render here. */}
      <Outlet />
    </div>
  );
}
