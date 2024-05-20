import { Construct } from "constructs";
import * as glue from 'aws-cdk-lib/aws-glue';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3Deployment from "aws-cdk-lib/aws-s3-deployment";
import { Bucket } from "aws-cdk-lib/aws-s3";

export class EmeaQuicksight extends Construct {
    construct_id: string

    constructor(scope: Construct, stack_id: string, scriptOutputBucket: any, glueJobRole: any, dynamoTableName: any, glueTableName: any, databaseNameIn: any, tags: any) {
        var construct_id = stack_id + '-' + dynamoTableName
        super(scope, construct_id)
        this.construct_id = construct_id

      //create Glue Job (step-2) (1 Glue job can maintain only 1 table- Repetative Function)
  
      const path = "lib/infrastructure/asset";
      new s3Deployment.BucketDeployment(this, "deployScripts", {
        sources: [s3Deployment.Source.asset(path)],
        destinationBucket: scriptOutputBucket,
      });

      // create Glue Job
      const gluetoS3job = new glue.CfnJob(this, 'glueToS3Job', {
        glueVersion: '3.0',
        name: tags['glueToS3-Job']+'-'+dynamoTableName,
        role: glueJobRole.roleArn,
        command: {
          name: 'glueetl',
          pythonVersion: '3',
          scriptLocation: `s3://${scriptOutputBucket.bucketName}/gluejob.py`,
        },
        defaultArguments: {
          '--job-bookmark-option': 'job-bookmark-enable',
          '--enable-metrics': '',
          '--enable-continuous-cloudwatch-log': 'true',
          '--DATABASE_NAME': databaseNameIn,
          '--TABLE_NAME': dynamoTableName,
          '--GLUE_TABLE_NAME': glueTableName,
          '--OUTPUT_BUCKET': tags['s3Buckets']['jobOutputBucketName']['name'],
          '--OUTPUT_PATH': dynamoTableName,
        },
        timeout: 60 * 24,//Take a look
      });
  
      //create Glue Job Triggers
      new glue.CfnTrigger(this, 'glueJobTrigger', {
        name: "triggergluejob"+'-'+dynamoTableName,
        schedule: tags["cronExpression"]["glueJob"],
        type: "SCHEDULED",
        description: "This Triggers the Glue job and stores the data from Glue table to S3",
        actions: [
          {
            jobName: gluetoS3job.name
          }
        ],
        startOnCreation: true,
      });

    }
}
