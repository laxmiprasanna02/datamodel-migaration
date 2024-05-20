import {aws_cloudfront, CfnOutput} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Certificate} from "aws-cdk-lib/aws-certificatemanager";

import {BucketPolicy, IBucket} from "aws-cdk-lib/aws-s3";
import {
    Distribution,
    AllowedMethods,
    ViewerProtocolPolicy,
    CloudFrontWebDistribution, ViewerCertificate, OriginAccessIdentity
} from "aws-cdk-lib/aws-cloudfront";
import {S3Origin} from "aws-cdk-lib/aws-cloudfront-origins"
import {ServicePrincipal, Effect, PolicyStatement} from "aws-cdk-lib/aws-iam";

export class EmeaCloudFront extends Construct {
    construct_id: string
    constructor(scope: Construct, stack_id: string, cloudFrontInfo: any, bucket: IBucket) {
        var construct_id = stack_id + '-' + cloudFrontInfo.domains
        super(scope, construct_id)
        this.construct_id = construct_id

        const oai = new OriginAccessIdentity(this, "cf-oai", {
            comment: `Cloudfront to reach ${bucket.bucketName}`,
        });
        bucket.grantRead(oai)
        const cloudfrontS3Origin = new S3Origin(bucket, {
            originAccessIdentity: oai,

        });
        const cfs3 = new Distribution(this, 'MyDistribution', {
            domainNames: cloudFrontInfo.domains,
            defaultBehavior: {
                origin: cloudfrontS3Origin,

                allowedMethods: aws_cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS
            },

            certificate: Certificate.fromCertificateArn(this, "cloudfront-certificate", cloudFrontInfo.cert),
        });


        new CfnOutput(this, 'cloudfront-distribution-id', {value: cfs3.distributionId})
        new CfnOutput(this, 'cloudfront-distribution-domain-name', {value: cfs3.distributionDomainName})
        new CfnOutput(this, 'domain-names', {value: JSON.stringify(cloudFrontInfo.domains)})
    }
}