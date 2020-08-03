"use strict";
/**
* This shows how to use standard Apollo client on Node.js
*/

global.WebSocket = require('ws');
require('es6-promise').polyfill();
require('isomorphic-fetch');

// Require exports file with endpoint and auth info

// Require AppSync module
const AWS = require('aws-sdk/global');
const AUTH_TYPE = require('aws-appsync/lib/link/auth-link').AUTH_TYPE;
const AWSAppSyncClient = require('aws-appsync').default;

// Import gql helper and craft a GraphQL query
const gql = require('graphql-tag');
const query = gql(`
query AllPosts {
allPost {
    __typename
    id
    title
    content
    author
    version
}
}`);

// Set up a subscription query
const subquery = gql(`
subscription NewPostSub {
newPost {
    __typename
    id
    title
    author
    version
}
}`);

const config = {
    url: process.env.APPSYNC_ENDPOINT,
    region: process.env.AWS_REGION,
    auth: {
      type: AUTH_TYPE.AWS_IAM,
      credentials: AWS.config.credentials,
    },
    disableOffline: true
};

// Set up Apollo client
const client = new AWSAppSyncClient(config);

exports.handler = async function(event){
    let api = client.hydrated().then(function (client) {
        return client.query({ query: query, fetchPolicy: 'network-only' }) 
            .then(function logData(data) {
                console.log('results of query: ', data);
                return JSON.stringify(data);
            })
            .catch(console.error);
    });

    return {
        statusCode: 200,
        headers: {"Content-Type": "application/json"},
        body: await api
    };
}