import { Inject, Injectable } from '@nestjs/common';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { ProductNotFoundError } from '../../../../domain/errors/product-not-found.error';
import { ProductModel } from '../../../../domain/models/product.model';
import {
  IProductRepository,
  ProductListFilters,
  ProductListPage,
} from '../../../../domain/protocols/database/repositories/product.repository.interface';
import { EnvService } from '../../../env/env.service';
import {
  TraceSpan,
  TracePrefixEnum,
} from '../../../../observability/trace.decorator';
import { DYNAMODB_DOCUMENT_CLIENT } from '../dynamodb-client.provider';
import { decodeCursor, encodeCursor } from '../cursor.util';
import { ProductMapper } from '../mapper/product.mapper';
import {
  buildActiveKey,
  buildCategoryActiveKey,
  PRODUCTS_GSI1_NAME,
  PRODUCTS_GSI2_NAME,
  ProductItem,
} from '../tables/products.table';

@Injectable()
export class DynamoDbProductRepository implements IProductRepository {
  constructor(
    @Inject(DYNAMODB_DOCUMENT_CLIENT)
    private readonly docClient: DynamoDBDocumentClient,
    private readonly env: EnvService,
  ) {}

  @TraceSpan({ prefix: TracePrefixEnum.Repository })
  async create(product: ProductModel): Promise<void> {
    await this.docClient.send(
      new PutCommand({
        TableName: this.env.get('PRODUCTS_TABLE_NAME'),
        Item: ProductMapper.toItem(product),
      }),
    );
  }

  @TraceSpan({ prefix: TracePrefixEnum.Repository })
  async findById(productId: string): Promise<ProductModel | null> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.env.get('PRODUCTS_TABLE_NAME'),
        Key: { productId },
      }),
    );
    const item = result.Item as ProductItem | undefined;
    return item ? ProductMapper.toDomain(item) : null;
  }

  @TraceSpan({ prefix: TracePrefixEnum.Repository })
  async update(
    productId: string,
    changes: Partial<Pick<ProductModel, 'name' | 'category' | 'active'>>,
  ): Promise<ProductModel> {
    const existing = await this.findById(productId);
    if (!existing) {
      throw new ProductNotFoundError();
    }

    const updated: ProductModel = {
      ...existing,
      ...changes,
      updatedAt: new Date().toISOString(),
    };

    // Read-modify-write: the derived GSI keys (category/active/name)
    // need to be recomputed together, which a plain UpdateExpression
    // can't express. The ConditionExpression guards against the item
    // having been deleted between the read above and this write.
    await this.docClient.send(
      new PutCommand({
        TableName: this.env.get('PRODUCTS_TABLE_NAME'),
        Item: ProductMapper.toItem(updated),
        ConditionExpression: 'attribute_exists(productId)',
      }),
    );

    return updated;
  }

  @TraceSpan({ prefix: TracePrefixEnum.Repository })
  async delete(productId: string): Promise<void> {
    await this.docClient.send(
      new DeleteCommand({
        TableName: this.env.get('PRODUCTS_TABLE_NAME'),
        Key: { productId },
      }),
    );
  }

  @TraceSpan({ prefix: TracePrefixEnum.Repository })
  async list(
    filters: ProductListFilters,
    cursor: string | undefined,
    limit: number,
  ): Promise<ProductListPage> {
    const exclusiveStartKey = decodeCursor(cursor);
    const expressionAttributeValues: Record<string, unknown> = {};
    let indexName: string;
    let keyConditionExpression: string;

    if (filters.category) {
      indexName = PRODUCTS_GSI1_NAME;
      expressionAttributeValues[':pk'] = buildCategoryActiveKey(
        filters.category,
        true,
      );
      keyConditionExpression = 'gsi1pk = :pk';
    } else {
      indexName = PRODUCTS_GSI2_NAME;
      expressionAttributeValues[':pk'] = buildActiveKey(true);
      keyConditionExpression = 'gsi2pk = :pk';
    }

    if (filters.namePrefix) {
      expressionAttributeValues[':prefix'] = filters.namePrefix.toLowerCase();
      keyConditionExpression += ' AND begins_with(nameSortKey, :prefix)';
    }

    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.env.get('PRODUCTS_TABLE_NAME'),
        IndexName: indexName,
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    const items = (result.Items ?? []).map((item) =>
      ProductMapper.toDomain(item as ProductItem),
    );

    return {
      items,
      nextCursor: encodeCursor(result.LastEvaluatedKey),
    };
  }
}
