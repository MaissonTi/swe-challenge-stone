import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { productCategorySchema } from '@swe-challenge-stone/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ProductNotFoundError } from '../../../domain/errors/product-not-found.error';
import {
  CREATE_PRODUCT_USE_CASE,
  ICreateProductUseCase,
} from '../../../domain/usecases/products/create-product.usecase';
import {
  DELETE_PRODUCT_USE_CASE,
  IDeleteProductUseCase,
} from '../../../domain/usecases/products/delete-product.usecase';
import {
  IListProductsUseCase,
  LIST_PRODUCTS_USE_CASE,
} from '../../../domain/usecases/products/list-products.usecase';
import {
  IUpdateProductUseCase,
  UPDATE_PRODUCT_USE_CASE,
} from '../../../domain/usecases/products/update-product.usecase';
import { TraceRoot } from '../../../observability/trace-root.decorator';
import {
  ApiBearerProtected,
  ApiRateLimited,
} from '../../../infra/swagger/api-common-responses.decorator';
import { ErrorResponseDto } from '../dtos/common/error-response.dto';
import { CreateProductDto } from '../dtos/products/create-product.dto';
import { ListProductsQueryDto } from '../dtos/products/list-products-query.dto';
import { ListProductsResponseDto } from '../dtos/products/list-products-response.dto';
import { UpdateProductDto } from '../dtos/products/update-product.dto';
import {
  ProductHttpDto,
  ProductPresenter,
} from '../presenters/product.presenter';

const EXAMPLE_PRODUCT = {
  id: '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
  name: 'Gaming Laptop 16GB',
  category: 'ELECTRONICS',
  active: true,
  createdAt: '2026-01-15T12:34:56.000Z',
  updatedAt: '2026-01-15T12:34:56.000Z',
};

@ApiTags('products')
@ApiRateLimited()
@ApiBearerProtected()
@Controller('v1/products')
export class ProductsController {
  constructor(
    @Inject(CREATE_PRODUCT_USE_CASE)
    private readonly createProductUseCase: ICreateProductUseCase,
    @Inject(UPDATE_PRODUCT_USE_CASE)
    private readonly updateProductUseCase: IUpdateProductUseCase,
    @Inject(DELETE_PRODUCT_USE_CASE)
    private readonly deleteProductUseCase: IDeleteProductUseCase,
    @Inject(LIST_PRODUCTS_USE_CASE)
    private readonly listProductsUseCase: IListProductsUseCase,
  ) {}

  @ApiOperation({ summary: 'Create a product (active by default)' })
  @ApiCreatedResponse({
    description: 'Product created',
    type: ProductHttpDto,
    example: EXAMPLE_PRODUCT,
  })
  @ApiBadRequestResponse({
    description: 'Invalid category or missing fields',
    type: ErrorResponseDto,
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @TraceRoot()
  async create(@Body() dto: CreateProductDto): Promise<ProductHttpDto> {
    const product = await this.createProductUseCase.execute(dto);
    return ProductPresenter.toHTTP(product);
  }

  @ApiOperation({
    summary: 'List active products (paginated, filterable)',
    description:
      "Cursor-based pagination - pass the previous page's `nextCursor` back " +
      'as `cursor` to get the next page. `name` matches a case-insensitive ' +
      'prefix, not a substring.',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: productCategorySchema.options,
  })
  @ApiQuery({
    name: 'name',
    required: false,
    description: 'Case-insensitive name prefix',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Opaque token from a previous page',
  })
  @ApiOkResponse({
    description: 'Page of active products',
    type: ListProductsResponseDto,
    example: {
      items: [EXAMPLE_PRODUCT],
      nextCursor:
        'eyJwcm9kdWN0SWQiOiIzZjFjMmQ0ZS01YTZiLTRjN2QtOGU5Zi0wYTFiMmMzZDRlNWYifQ',
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid category value',
    type: ErrorResponseDto,
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  @TraceRoot()
  async list(
    @Query() query: ListProductsQueryDto,
  ): Promise<ListProductsResponseDto> {
    const page = await this.listProductsUseCase.execute({
      category: query.category,
      namePrefix: query.name,
      cursor: query.cursor,
    });

    return {
      items: page.items.map(ProductPresenter.toHTTP),
      nextCursor: page.nextCursor,
    };
  }

  @ApiOperation({
    summary: 'Update a product, including deactivating it',
    description:
      'Deactivating (`active: false`) is distinct from deleting - the ' +
      'product stays in storage but drops out of the default listing.',
  })
  @ApiParam({
    name: 'id',
    description: 'Product id',
    schema: { type: 'string', format: 'uuid' },
    example: '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
  })
  @ApiOkResponse({
    description: 'Product updated',
    type: ProductHttpDto,
    example: { ...EXAMPLE_PRODUCT, active: false },
  })
  @ApiBadRequestResponse({
    description: 'No fields provided, or invalid field values',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'No product with this id',
    type: ErrorResponseDto,
  })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @TraceRoot()
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductHttpDto> {
    try {
      const product = await this.updateProductUseCase.execute({
        productId: id,
        ...dto,
      });
      return ProductPresenter.toHTTP(product);
    } catch (err) {
      if (err instanceof ProductNotFoundError) {
        throw new NotFoundException('Product not found');
      }
      throw err;
    }
  }

  @ApiOperation({
    summary: 'Permanently delete a product',
    description: 'Physical removal, independent of `active`. Idempotent.',
  })
  @ApiParam({
    name: 'id',
    description: 'Product id',
    schema: { type: 'string', format: 'uuid' },
    example: '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
  })
  @ApiNoContentResponse({ description: 'Product deleted (or already gone)' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @TraceRoot()
  async delete(@Param('id') id: string): Promise<void> {
    await this.deleteProductUseCase.execute({ productId: id });
  }
}
