import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  createProductSchema,
  type CreateProductInput,
} from '@swe-challenge-stone/common';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { productsService } from '@/services/products.service';
import type { Product } from '@/types/api';

const CATEGORY_OPTIONS: CreateProductInput['category'][] = [
  'ELECTRONICS',
  'CLOTHING',
  'HOME',
  'BOOKS',
  'TOYS',
  'FOOD',
  'OTHER',
];

export function ProductFormModal() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const editingProduct = (location.state as { product?: Product } | undefined)
    ?.product;
  const isEditing = Boolean(id);

  const form = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      name: editingProduct?.name ?? '',
      category: editingProduct?.category,
    },
  });

  function close() {
    navigate('/products');
  }

  const mutation = useMutation({
    mutationFn: (values: CreateProductInput) =>
      isEditing && id
        ? productsService.update(id, values)
        : productsService.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: isEditing ? 'Product updated' : 'Product created' });
      close();
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Something went wrong',
        description: 'Unable to save the product. Please try again.',
      });
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit product' : 'New product'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the product's details."
              : "Fill in the new product's details."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="grid gap-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
