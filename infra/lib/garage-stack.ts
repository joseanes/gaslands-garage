import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { RemovalPolicy } from 'aws-cdk-lib';
import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Distribution, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';

export class GarageStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- S3 bucket for the static site ---
    const siteBucket = new Bucket(this, 'SiteBucket', {
      websiteIndexDocument: 'index.html',
      encryption: BucketEncryption.S3_MANAGED,
      publicReadAccess: false,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // --- CloudFront distribution in front of the bucket ---
    const cdn = new Distribution(this, 'CDN', {
      defaultBehavior: {
        origin: new S3Origin(siteBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      }
    });

    // --- Outputs so we can find them later ---
    new cdk.CfnOutput(this, 'BucketName', {
      value: siteBucket.bucketName
    });

    new cdk.CfnOutput(this, 'CDNDistributionDomainName', {
      value: cdn.domainName
    });
  }
}

