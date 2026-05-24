// app/lib/dynamodb.ts

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// DynamoDBDocumentClient marshals/unmarshals plain JS objects automatically
// so you don't have to deal with DynamoDB's { S: "value" } format
export const dynamo = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true, // skip fields that are undefined
    convertEmptyValues: false,
  },
});

export const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME!;