/* eslint-disable no-console */
import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { envSchema } from '../src/infra/env/env';
import { ARGON2_OPTIONS } from '../src/infra/cryptography/argon2-hasher';
import {
  buildActiveKey,
  buildCategoryActiveKey,
  buildNameSortKey,
} from '../src/infra/database/dynamodb/tables/products.table';

const env = envSchema.parse(process.env);

const docClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: env.AWS_REGION,
    endpoint: env.DYNAMODB_ENDPOINT,
  }),
  { marshallOptions: { removeUndefinedValues: true } },
);

const SEED_USERS = [{ email: 'demo@stone.com.br', password: 'Demo1234' }];

type Category =
  'ELECTRONICS' | 'CLOTHING' | 'HOME' | 'BOOKS' | 'TOYS' | 'FOOD' | 'OTHER';

// Product names per category: each "base" carries its own variants
// (instead of a generic category x variant cartesian product, which
// produced nonsensical combos like "Action Figure 1000 Pieces") -
// gives 50 unique names plausible enough to exercise pagination/filter
// on the listing, without typing 50 by hand or falling back to
// something generic like "Product 23".
const PRODUCT_TEMPLATES: Record<
  Category,
  Array<{ base: string; variants: [string, string] }>
> = {
  ELECTRONICS: [
    { base: 'Laptop', variants: ['Gaming', 'Ultrathin'] },
    { base: 'Headphones', variants: ['Bluetooth', 'Wireless'] },
    { base: 'Mouse', variants: ['Gaming', 'Wireless'] },
    { base: 'Monitor', variants: ['Ultrawide', '4K'] },
  ],
  CLOTHING: [
    { base: 'T-Shirt', variants: ['Basic', 'Printed'] },
    { base: 'Jacket', variants: ['Windbreaker', 'Denim'] },
    { base: 'Pants', variants: ['Jeans', 'Jogger'] },
    { base: 'Sneakers', variants: ['Athletic', 'Casual'] },
  ],
  HOME: [
    { base: 'Sofa', variants: ['3-Seater', 'Reclining'] },
    { base: 'Dining Table', variants: ['4-Seat', '6-Seat'] },
    { base: 'Lamp', variants: ['Floor', 'Table'] },
    { base: 'Rug', variants: ['Persian', 'Rectangular'] },
  ],
  BOOKS: [
    { base: 'Book: Clean Code', variants: ['1st Edition', '2nd Edition'] },
    {
      base: 'Book: The Pragmatic Programmer',
      variants: ['1st Edition', '2nd Edition'],
    },
    {
      base: 'Book: Domain-Driven Design',
      variants: ['1st Edition', '2nd Edition'],
    },
  ],
  TOYS: [
    { base: 'Puzzle', variants: ['500 Pieces', '1000 Pieces'] },
    { base: 'Action Figure', variants: ['Articulated', "Collector's Edition"] },
    { base: 'Board Game', variants: ['Classic', 'Family Edition'] },
  ],
  FOOD: [
    { base: 'Coffee Beans', variants: ['500g', 'Imported'] },
    { base: 'Dark Chocolate', variants: ['500g', 'Imported'] },
    { base: 'Extra Virgin Olive Oil', variants: ['500ml', 'Imported'] },
  ],
  OTHER: [
    { base: 'Backpack', variants: ['Waterproof', 'Executive'] },
    { base: 'Thermal Bottle', variants: ['Stainless Steel', '1 Liter'] },
    { base: 'Tool Kit', variants: ['50 Pieces', 'Professional'] },
    { base: 'Umbrella', variants: ['Automatic', 'Compact'] },
  ],
};

function buildSeedProducts(): Array<{ name: string; category: Category }> {
  const products: Array<{ name: string; category: Category }> = [];
  for (const [category, entries] of Object.entries(PRODUCT_TEMPLATES) as Array<
    [Category, Array<{ base: string; variants: [string, string] }>]
  >) {
    for (const { base, variants } of entries) {
      for (const variant of variants) {
        products.push({ name: `${base} ${variant}`, category });
      }
    }
  }
  return products;
}

const SEED_PRODUCTS = buildSeedProducts();

async function seedUsers() {
  for (const { email, password } of SEED_USERS) {
    const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
    await docClient.send(
      new PutCommand({
        TableName: env.USERS_TABLE_NAME,
        Item: {
          email,
          userId: randomUUID(),
          passwordHash,
          createdAt: new Date().toISOString(),
        },
      }),
    );
    console.log(`Seeded user: ${email} (password: ${password})`);
  }
}

async function seedProducts() {
  for (const { name, category } of SEED_PRODUCTS) {
    const productId = randomUUID();
    const nameLower = name.toLowerCase();
    const now = new Date().toISOString();
    await docClient.send(
      new PutCommand({
        TableName: env.PRODUCTS_TABLE_NAME,
        Item: {
          productId,
          name,
          nameLower,
          category,
          active: true,
          createdAt: now,
          updatedAt: now,
          gsi1pk: buildCategoryActiveKey(category, true),
          gsi2pk: buildActiveKey(true),
          nameSortKey: buildNameSortKey(nameLower, productId),
        },
      }),
    );
    console.log(`Seeded product: ${name} (${category})`);
  }
}

async function main() {
  await seedUsers();
  await seedProducts();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
