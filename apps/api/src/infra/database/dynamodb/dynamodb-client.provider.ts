import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { EnvService } from '../../env/env.service';

export const DYNAMODB_DOCUMENT_CLIENT = Symbol('DynamoDbDocumentClient');

export const dynamoDbDocumentClientProvider = {
  provide: DYNAMODB_DOCUMENT_CLIENT,
  useFactory: (env: EnvService) => {
    const client = new DynamoDBClient({
      region: env.get('AWS_REGION'),
      // Set only for LocalStack; undefined lets the SDK resolve real AWS endpoints.
      endpoint: env.get('DYNAMODB_ENDPOINT'),
    });
    return DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  },
  inject: [EnvService],
};
