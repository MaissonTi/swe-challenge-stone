/* eslint-disable no-console */
import 'dotenv/config';
import {
  CreateTableCommand,
  DynamoDBClient,
  ResourceInUseException,
} from '@aws-sdk/client-dynamodb';
import { envSchema } from '../src/infra/env/env';
import {
  PRODUCTS_GSI1_NAME,
  PRODUCTS_GSI2_NAME,
} from '../src/infra/database/dynamodb/tables/products.table';
import { USERS_GSI1_NAME } from '../src/infra/database/dynamodb/tables/users.table';

const env = envSchema.parse(process.env);

const client = new DynamoDBClient({
  region: env.AWS_REGION,
  endpoint: env.DYNAMODB_ENDPOINT ?? 'http://localhost:4566',
});

async function createUsersTable() {
  await client.send(
    new CreateTableCommand({
      TableName: env.USERS_TABLE_NAME,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'email', AttributeType: 'S' },
        { AttributeName: 'userId', AttributeType: 'S' },
      ],
      KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
      GlobalSecondaryIndexes: [
        {
          IndexName: USERS_GSI1_NAME,
          KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    }),
  );
}

async function createProductsTable() {
  await client.send(
    new CreateTableCommand({
      TableName: env.PRODUCTS_TABLE_NAME,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'productId', AttributeType: 'S' },
        { AttributeName: 'gsi1pk', AttributeType: 'S' },
        { AttributeName: 'gsi2pk', AttributeType: 'S' },
        { AttributeName: 'nameSortKey', AttributeType: 'S' },
      ],
      KeySchema: [{ AttributeName: 'productId', KeyType: 'HASH' }],
      GlobalSecondaryIndexes: [
        {
          IndexName: PRODUCTS_GSI1_NAME,
          KeySchema: [
            { AttributeName: 'gsi1pk', KeyType: 'HASH' },
            { AttributeName: 'nameSortKey', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: PRODUCTS_GSI2_NAME,
          KeySchema: [
            { AttributeName: 'gsi2pk', KeyType: 'HASH' },
            { AttributeName: 'nameSortKey', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    }),
  );
}

async function main() {
  for (const [name, create] of Object.entries({
    [env.USERS_TABLE_NAME]: createUsersTable,
    [env.PRODUCTS_TABLE_NAME]: createProductsTable,
  })) {
    try {
      await create();
      console.log(`Created table: ${name}`);
    } catch (err) {
      if (err instanceof ResourceInUseException) {
        console.log(`Table already exists, skipping: ${name}`);
      } else {
        throw err;
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
