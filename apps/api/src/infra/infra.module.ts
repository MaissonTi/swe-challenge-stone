import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { HASHER } from '../domain/protocols/cryptography/hasher.interface';
import { ENCRYPTER } from '../domain/protocols/cryptography/encrypter.interface';
import { TOKEN_REVOCATION_STORE } from '../domain/protocols/cache/token-revocation-store.interface';
import { RATE_LIMITER } from '../domain/protocols/cache/rate-limiter.interface';
import { PRODUCT_LIST_CACHE } from '../domain/protocols/cache/product-list-cache.interface';
import { USER_REPOSITORY } from '../domain/protocols/database/repositories/user.repository.interface';
import { PRODUCT_REPOSITORY } from '../domain/protocols/database/repositories/product.repository.interface';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { JwtStrategy } from './auth/jwt.strategy';
import { redisClientProvider } from './cache/redis-client.provider';
import { RedisProductListCache } from './cache/redis-product-list-cache';
import { RedisRateLimiter } from './cache/redis-rate-limiter';
import { RedisTokenRevocationStore } from './cache/redis-token-revocation-store';
import { Argon2Hasher } from './cryptography/argon2-hasher';
import { JwtEncrypter } from './cryptography/jwt-encrypter';
import { dynamoDbDocumentClientProvider } from './database/dynamodb/dynamodb-client.provider';
import { DynamoDbProductRepository } from './database/dynamodb/repositories/dynamodb-product.repository';
import { DynamoDbUserRepository } from './database/dynamodb/repositories/dynamodb-user.repository';
import { RateLimitGuard } from './rate-limit/rate-limit.guard';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  providers: [
    redisClientProvider,
    dynamoDbDocumentClientProvider,
    JwtStrategy,
    // Order matters: JwtAuthGuard must run before RateLimitGuard so
    // `request.user` is already set when the rate limiter picks its key.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: HASHER, useClass: Argon2Hasher },
    { provide: ENCRYPTER, useClass: JwtEncrypter },
    { provide: TOKEN_REVOCATION_STORE, useClass: RedisTokenRevocationStore },
    { provide: RATE_LIMITER, useClass: RedisRateLimiter },
    { provide: PRODUCT_LIST_CACHE, useClass: RedisProductListCache },
    { provide: USER_REPOSITORY, useClass: DynamoDbUserRepository },
    { provide: PRODUCT_REPOSITORY, useClass: DynamoDbProductRepository },
  ],
  exports: [
    HASHER,
    ENCRYPTER,
    TOKEN_REVOCATION_STORE,
    RATE_LIMITER,
    PRODUCT_LIST_CACHE,
    USER_REPOSITORY,
    PRODUCT_REPOSITORY,
  ],
})
export class InfraModule {}
