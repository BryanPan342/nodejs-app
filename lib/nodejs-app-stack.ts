import {join} from 'path';
import * as apigw from '@aws-cdk/aws-apigateway';
import * as appsync from '@aws-cdk/aws-appsync';
import * as db from '@aws-cdk/aws-dynamodb';
import * as lambda from '@aws-cdk/aws-lambda';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';

export class NodejsAppStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const api = new appsync.GraphQLApi(this, 'MyApi', {
      name: 'api',
      schemaDefinitionFile: join(__dirname, 'schema.graphql'),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.IAM,
        },
      }
    });

    const role = new iam.Role(this, 'MyFuncRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    
    api.grant(role, appsync.IamResource.all(), 'appsync:GraphQL');

    const func = new lambda.Function(this, 'MyFunction', {
      timeout: cdk.Duration.minutes(1),
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'client.handler',
      role: role,
      environment: {"APPSYNC_ENDPOINT": api.graphQlUrl },
    });

    new apigw.LambdaRestApi(this, 'Endpoint', {
      handler: func,
    });

    const table = new db.Table(this, 'MyTable', {
      partitionKey: {
        name: 'id',
        type: db.AttributeType.STRING,
      },
      tableName: `MyTablePost`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    table.addGlobalSecondaryIndex({
      indexName: 'author-index',
      partitionKey: {
        name: 'author',
        type: db.AttributeType.STRING,
      }
    });

    const tableDS = api.addDynamoDbDataSource('tableDS', 'Table Data Source', table);

    /* ATTRIBUTES */
    const author = new appsync.Assign('author', '$context.arguments.input.author');
    const title = new appsync.Assign('title', '$context.arguments.input.title');
    const content = new appsync.Assign('content', '$context.arguments.input.content');
    const url = new appsync.Assign('url', '$context.arguments.input.url');
    const ups = new appsync.Assign('ups', `1`);
    const downs = new appsync.Assign('downs', `0`);
    const version = new appsync.Assign('version', `1`);

    /* MUTATIONS */
    tableDS.createResolver({
      typeName: 'Mutation',
      fieldName: 'addPost',
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbPutItem(
        appsync.PrimaryKey.partition('id').auto(), new appsync.AttributeValues('$context.arguments.input', 
          [ author, title, content, url, ups, downs, version ],
        ),
      ),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

    tableDS.createResolver({
      typeName: 'Mutation',
      fieldName: 'updatePost',
      requestMappingTemplate: appsync.MappingTemplate.fromFile(join(__dirname, 'update.vtl')),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

    tableDS.createResolver({
      typeName: 'Mutation',
      fieldName: 'upvotePost',
      requestMappingTemplate: appsync.MappingTemplate.fromString(`{
        "version" : "2017-02-28",
        "operation" : "UpdateItem",
        "key" : {
            "id" : $util.dynamodb.toDynamoDBJson($context.arguments.id)
        },
        "update" : {
            "expression" : "ADD ups :plusOne, version :plusOne",
            "expressionValues" : {
                ":plusOne" : { "N" : 1 }
            }
        }
      }`),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

    tableDS.createResolver({
      typeName: 'Mutation',
      fieldName: 'downvotePost',
      requestMappingTemplate: appsync.MappingTemplate.fromString(`{
        "version" : "2017-02-28",
        "operation" : "UpdateItem",
        "key" : {
            "id" : $util.dynamodb.toDynamoDBJson($context.arguments.id)
        },
        "update" : {
            "expression" : "ADD downs :plusOne, version :plusOne",
            "expressionValues" : {
                ":plusOne" : { "N" : 1 }
            }
        }
      }`),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

    tableDS.createResolver({
      typeName: 'Mutation',
      fieldName: 'deletePost',
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbDeleteItem('id', 'id'),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

    /* QUERIES */
    tableDS.createResolver({
      typeName: 'Query',
      fieldName: 'getPost',
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbGetItem('id', 'id'),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

    tableDS.createResolver({
      typeName: 'Query',
      fieldName: 'allPost',
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbScanTable(),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultList(),
    });
  }
}
