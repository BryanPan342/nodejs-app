#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { NodejsAppStack } from '../lib/nodejs-app-stack';

const app = new cdk.App();
new NodejsAppStack(app, 'NodejsAppStack');
