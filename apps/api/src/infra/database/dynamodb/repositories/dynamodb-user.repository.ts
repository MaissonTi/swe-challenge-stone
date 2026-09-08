import { Inject, Injectable } from '@nestjs/common';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { EmailAlreadyRegisteredError } from '../../../../domain/errors/email-already-registered.error';
import { UserModel } from '../../../../domain/models/user.model';
import { IUserRepository } from '../../../../domain/protocols/database/repositories/user.repository.interface';
import { EnvService } from '../../../env/env.service';
import {
  TraceSpan,
  TracePrefixEnum,
} from '../../../../observability/trace.decorator';
import { DYNAMODB_DOCUMENT_CLIENT } from '../dynamodb-client.provider';
import { UserMapper } from '../mapper/user.mapper';
import { USERS_GSI1_NAME, UserItem } from '../tables/users.table';

@Injectable()
export class DynamoDbUserRepository implements IUserRepository {
  constructor(
    @Inject(DYNAMODB_DOCUMENT_CLIENT)
    private readonly docClient: DynamoDBDocumentClient,
    private readonly env: EnvService,
  ) {}

  @TraceSpan({ prefix: TracePrefixEnum.Repository })
  async findByEmail(email: string): Promise<UserModel | null> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.env.get('USERS_TABLE_NAME'),
        Key: { email },
      }),
    );
    const item = result.Item as UserItem | undefined;
    return item ? UserMapper.toDomain(item) : null;
  }

  @TraceSpan({ prefix: TracePrefixEnum.Repository })
  async findById(userId: string): Promise<UserModel | null> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.env.get('USERS_TABLE_NAME'),
        IndexName: USERS_GSI1_NAME,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        Limit: 1,
      }),
    );
    const item = result.Items?.[0] as UserItem | undefined;
    return item ? UserMapper.toDomain(item) : null;
  }

  @TraceSpan({ prefix: TracePrefixEnum.Repository })
  async create(user: UserModel): Promise<void> {
    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.env.get('USERS_TABLE_NAME'),
          Item: UserMapper.toItem(user),
          ConditionExpression: 'attribute_not_exists(email)',
        }),
      );
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        throw new EmailAlreadyRegisteredError();
      }
      throw err;
    }
  }
}
