import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as glue from "aws-cdk-lib/aws-glue";
import * as iam from "aws-cdk-lib/aws-iam";
import { EmeaQuicksight } from "../constructs/quicksight/emea_quicksight";
import { EmeaS3 } from "../constructs/s3/emea_s3";

export class PlatformQuicksightStack extends Stack {
  constructor(scope: Construct, id: string, tags: any, props?: StackProps) {
    super(scope, id, props);

    //create Glue Database
    new glue.CfnDatabase(this, "dynamoToGluedb-In", {
      catalogId: tags["pipeline_account"],
      databaseInput: {
        name: tags["databaseNameIn"],
      },
    });

    //create Glue crawler role
    const crawlerRole = new iam.Role(this, "crawlerRoleDynamodbToGlue", {
      assumedBy: new iam.ServicePrincipal("glue"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSGlueServiceRole"
        ),
      ],
    });

    //create inline policies
    const dynamotoGlueInlinepolicy = new iam.Policy(
      this,
      "inlinePolicyDynamodbToGlue",
      {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["dynamodb:DescribeTable", "dynamodb:Scan"],
            resources: ["*"],
          }),
        ],
      }
    );

    //attach the Policy to the role
    crawlerRole.attachInlinePolicy(dynamotoGlueInlinepolicy);

    //create Glue crawler
    new glue.CfnCrawler(this, "dynamodbToGlueCrawler", {
      role: crawlerRole.roleArn,
      targets: {
        dynamoDbTargets: [
          {
            path: tags["tableName"]["usersTable"]["dynamoTable"],
          },
          {
            path: tags["tableName"]["poolsTable"]["dynamoTable"],
          },
          {
            path: tags["tableName"]["devicesTable"]["dynamoTable"],
          },
          {
            path: tags["tableName"]["configFiles"]["dynamoTable"],
          },
          {
            path: tags["tableName"]["alerts"]["dynamoTable"],
          },
        ],
      },
      databaseName: tags["databaseNameIn"],
      description:
        "These Crawler is created to Crawl data from Dynamo DB to Glue",
      schedule: {
        scheduleExpression: tags["cronExpression"]["crawlerdynamotoGlue"],
      },
      name: tags["dynamoToGlue-Crawler"],
    });

    //##################Create Glue Job (Glue Db to S3) (Step-2)##################
    //Create Glue Job role
    const glueJobRole = new iam.Role(this, "glueJobRole", {
      assumedBy: new iam.ServicePrincipal("glue"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSGlueServiceRole"
        ),
      ],
    });

    //create inline policy
    const gluetoS3Inlinepolicy = new iam.Policy(this, "gluetoS3Inlinepolicy", {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "s3:PutObject",
            "dynamodb:DescribeTable",
            "dynamodb:Scan",
            "s3:*",
            "s3-object-lambda:*",
          ],
          resources: ["*"],
        }),
      ],
    });

    //attach the Policy to the role
    glueJobRole.attachInlinePolicy(gluetoS3Inlinepolicy);

    //Create Script S3 Bucket and Upload Script in it from (../asset/gluejob.py)
    const scriptOutputBucket = new EmeaS3(this, id, tags['s3Buckets']["scriptBucketName"],tags["pipeline_region"]);

    // Create Glue Job output bucket
    const jobOutputBucket = new EmeaS3(this, id, tags['s3Buckets']["jobOutputBucketName"],tags["pipeline_region"]);

    if (scriptOutputBucket.bucket && jobOutputBucket.bucket) {
      // Allow job role to read script
      scriptOutputBucket.bucket.grantRead(glueJobRole);
      // Allow job role to read and write to output bucket
      jobOutputBucket.bucket.grantReadWrite(glueJobRole);

      //call Glue job
      new EmeaQuicksight(
        this,
        id,
        scriptOutputBucket.bucket,
        glueJobRole,
        tags["tableName"]["usersTable"]["dynamoTable"],
        tags["tableName"]["usersTable"]["glueTable"],
        tags["databaseNameIn"],
        tags
      );
      new EmeaQuicksight(
        this,
        id,
        scriptOutputBucket.bucket,
        glueJobRole,
        tags["tableName"]["poolsTable"]["dynamoTable"],
        tags["tableName"]["poolsTable"]["glueTable"],
        tags["databaseNameIn"],
        tags
      );
      new EmeaQuicksight(
        this,
        id,
        scriptOutputBucket.bucket,
        glueJobRole,
        tags["tableName"]["devicesTable"]["dynamoTable"],
        tags["tableName"]["devicesTable"]["glueTable"],
        tags["databaseNameIn"],
        tags
      );
      new EmeaQuicksight(
        this,
        id,
        scriptOutputBucket.bucket,
        glueJobRole,
        tags["tableName"]["configFiles"]["dynamoTable"],
        tags["tableName"]["configFiles"]["glueTable"],
        tags["databaseNameIn"],
        tags
      );
      new EmeaQuicksight(
        this,
        id,
        scriptOutputBucket.bucket,
        glueJobRole,
        tags["tableName"]["alerts"]["dynamoTable"],
        tags["tableName"]["alerts"]["glueTable"],
        tags["databaseNameIn"],
        tags
      );
    }

    //##################Create Crawler (S3 to Glue DB - Athena) (Step-3)##################

    //create Glue Database
    new glue.CfnDatabase(this, "s3ToGluedb-Out", {
      catalogId: tags["pipeline_account"],
      databaseInput: {
        name: tags["databaseNameOut"],
      },
    });

    //Create S3toGlueCrawler Role
    const s3toGlueCrawlerRole = new iam.Role(this, "crawlerRoleS3ToGlue", {
      assumedBy: new iam.ServicePrincipal("glue"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSGlueServiceRole"
        ),
      ],
    });

    //create inline policies
    const s3toGlueInlinepolicy = new iam.Policy(this, "inlinePolicyS3ToGlue", {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["s3:GetObject"],
          resources: ["*"],
        }),
      ],
    });

    //attach the Policy to the role
    s3toGlueCrawlerRole.attachInlinePolicy(s3toGlueInlinepolicy);

    //create S3toGlue crawler
    new glue.CfnCrawler(this, "s3ToGlueCrawler", {
      role: s3toGlueCrawlerRole.roleArn,
      targets: {
        s3Targets: [
          {
            path: `s3://${tags['s3Buckets']["jobOutputBucketName"]["name"]}/`,
          },
        ],
      },
      name: tags["s3ToGlue-Crawler"],
      databaseName: tags["databaseNameOut"],
      description: "These Crawler is created to Crawl data from S3 to Glue",
      schedule: {
        scheduleExpression: tags["cronExpression"]["s3ToGlue-Crawler"],
      },
    });
  }
}
