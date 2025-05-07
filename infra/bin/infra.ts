import * as cdk from 'aws-cdk-lib';
import { GarageStack } from '../lib/garage-stack';

const app = new cdk.App();
new GarageStack(app, 'InfraStack', {
  domainName: 'gaslandsgarage.com',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});   // keep the stack name but use GarageStack class

