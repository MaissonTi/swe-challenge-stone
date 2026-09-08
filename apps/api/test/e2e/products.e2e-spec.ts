import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { createTestApp } from './helpers/create-test-app';
import { resetRateLimits } from './helpers/reset-rate-limits';

describe('Products (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    await resetRateLimits();
    app = await createTestApp();

    const email = `e2e-products-${randomUUID()}@stone.com.br`;
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, password: 'Password1' })
      .expect(204);
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'Password1' })
      .expect(200);
    accessToken = login.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication to list products', async () => {
    await request(app.getHttpServer()).get('/v1/products').expect(401);
  });

  it('creates a product active by default', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: `e2e product ${randomUUID()}`, category: 'ELECTRONICS' })
      .expect(201);

    expect(response.body).toMatchObject({
      active: true,
      category: 'ELECTRONICS',
    });
    expect(response.body.id).toEqual(expect.any(String));
  });

  it('rejects an invalid category on create', async () => {
    await request(app.getHttpServer())
      .post('/v1/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'X', category: 'NOT_A_REAL_CATEGORY' })
      .expect(400);
  });

  it('finds a freshly created product through the category and name-prefix filters', async () => {
    const uniqueName = `Zzyzx Gadget ${randomUUID()}`;
    const created = await request(app.getHttpServer())
      .post('/v1/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: uniqueName, category: 'TOYS' })
      .expect(201);

    const byCategory = await request(app.getHttpServer())
      .get('/v1/products')
      .query({ category: 'TOYS', name: 'zzyzx' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(byCategory.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.body.id }),
      ]),
    );
  });

  it('updates a product, including deactivating it', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: `e2e product ${randomUUID()}`, category: 'BOOKS' })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/v1/products/${created.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ active: false })
      .expect(200);

    expect(updated.body.active).toBe(false);
    // Not re-verified via listing here - excluding inactive items at
    // the GSI level is covered directly, without the cache in the way,
    // in test/integration/dynamodb-product-repository.integration-spec.ts.
    // (The write now invalidates the listing cache; see the
    // generation-scoped key in list-products.usecase.ts.)
  });

  it('returns 404 when updating a product that does not exist', async () => {
    await request(app.getHttpServer())
      .patch('/v1/products/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'does not matter' })
      .expect(404);
  });

  it('permanently deletes a product', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: `e2e product ${randomUUID()}`, category: 'FOOD' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/v1/products/${created.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    // Deleting an id that's already gone is idempotent, not an error.
    await request(app.getHttpServer())
      .delete(`/v1/products/${created.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);
  });
});
