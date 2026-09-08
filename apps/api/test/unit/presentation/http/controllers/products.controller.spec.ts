import { NotFoundException } from '@nestjs/common';
import { ProductNotFoundError } from '@/domain/errors/product-not-found.error';
import { ProductsController } from '@/presentation/http/controllers/products.controller';

describe('ProductsController', () => {
  function makeUseCases() {
    return {
      createProductUseCase: { execute: jest.fn() },
      updateProductUseCase: { execute: jest.fn() },
      deleteProductUseCase: { execute: jest.fn() },
      listProductsUseCase: { execute: jest.fn() },
    };
  }

  function makeController(useCases: ReturnType<typeof makeUseCases>) {
    return new ProductsController(
      useCases.createProductUseCase as any,
      useCases.updateProductUseCase as any,
      useCases.deleteProductUseCase as any,
      useCases.listProductsUseCase as any,
    );
  }

  const product = {
    productId: 'p1',
    name: 'Notebook',
    category: 'ELECTRONICS' as const,
    active: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  it('create: presents the created product', async () => {
    const useCases = makeUseCases();
    useCases.createProductUseCase.execute.mockResolvedValueOnce(product);
    const controller = makeController(useCases);

    const result = await controller.create({
      name: 'Notebook',
      category: 'ELECTRONICS',
    } as any);

    expect(result).toEqual({
      id: 'p1',
      name: 'Notebook',
      category: 'ELECTRONICS',
      active: true,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    });
  });

  it('list: forwards filters and presents each item plus the cursor', async () => {
    const useCases = makeUseCases();
    useCases.listProductsUseCase.execute.mockResolvedValueOnce({
      items: [product],
      nextCursor: 'abc',
    });
    const controller = makeController(useCases);

    const result = await controller.list({
      category: 'ELECTRONICS',
      name: 'note',
      cursor: undefined,
    } as any);

    expect(useCases.listProductsUseCase.execute).toHaveBeenCalledWith({
      category: 'ELECTRONICS',
      namePrefix: 'note',
      cursor: undefined,
    });
    expect(result.items).toEqual([expect.objectContaining({ id: 'p1' })]);
    expect(result.nextCursor).toBe('abc');
  });

  it('update: presents the updated product', async () => {
    const useCases = makeUseCases();
    useCases.updateProductUseCase.execute.mockResolvedValueOnce({
      ...product,
      active: false,
    });
    const controller = makeController(useCases);

    const result = await controller.update('p1', { active: false } as any);

    expect(useCases.updateProductUseCase.execute).toHaveBeenCalledWith({
      productId: 'p1',
      active: false,
    });
    expect(result.active).toBe(false);
  });

  it('update: translates ProductNotFoundError into a 404 NotFoundException', async () => {
    const useCases = makeUseCases();
    useCases.updateProductUseCase.execute.mockRejectedValueOnce(
      new ProductNotFoundError(),
    );
    const controller = makeController(useCases);

    await expect(
      controller.update('does-not-exist', {} as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('update: propagates unrelated errors unchanged', async () => {
    const useCases = makeUseCases();
    useCases.updateProductUseCase.execute.mockRejectedValueOnce(
      new Error('boom'),
    );
    const controller = makeController(useCases);

    await expect(controller.update('p1', {} as any)).rejects.toThrow('boom');
  });

  it('delete: delegates to the use case', async () => {
    const useCases = makeUseCases();
    const controller = makeController(useCases);

    await controller.delete('p1');

    expect(useCases.deleteProductUseCase.execute).toHaveBeenCalledWith({
      productId: 'p1',
    });
  });
});
