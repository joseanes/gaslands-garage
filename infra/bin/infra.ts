import * as cdk from 'aws-cdk-lib';
import { GarageStack } from '../lib/garage-stack';
import { CertificateStack } from '../lib/certificate-stack';

const app = new cdk.App();

// Define environment variables from context or use defaults
const account = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID;
const region = process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1';
const domainName = 'gaslandsgarage.com';

// Create certificate stack in us-east-1
const certificateStack = new CertificateStack(app, 'CertificateStack', {
  domainName,
  env: {
    account,
    region: 'us-east-1'  // Force us-east-1 for the certificate
  }
});

// Create main infrastructure stack in the default region
new GarageStack(app, 'InfraStack', {
  domainName,
  env: {
    account,
    region
  },
  // Pass the certificate ARN explicitly
  certificateArn: certificateStack.certificate.certificateArn
});

