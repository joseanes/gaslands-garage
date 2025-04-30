import * as cdk from 'aws-cdk-lib';
import { GarageStack } from '../lib/garage-stack';

const app = new cdk.App();
new GarageStack(app, 'InfraStack', {});   // keep the stack name but use GarageStack class

