import {RemovalPolicy} from "aws-cdk-lib";
import {Construct} from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import {S3Client, GetBucketEncryptionCommand} from "@aws-sdk/client-s3";
import {ListBucketsCommand} from "@aws-sdk/client-s3";

export class EmeaS3 extends Construct {
    construct_id: string;
    bucket: s3.Bucket | s3.IBucket | undefined;

    constructor(scope: Construct, stack_id: string, bucketInfo: any, region: string) {
        const construct_id = stack_id + "-" + bucketInfo.name;
        super(scope, construct_id);
        this.construct_id = construct_id;
        this.bucket = undefined;
        if (bucketInfo.exists) {
            console.log("s3 bucket " + bucketInfo.name + " with flag exists")
            this.bucket = s3.Bucket.fromBucketAttributes(this, this.construct_id + "-bucket", {
                bucketArn: "arn:aws:s3:::" + bucketInfo.name,
                region: region
            });
            return
        } else {
            this.bucket = new s3.Bucket(this, this.construct_id + "-bucket", {
                bucketName: bucketInfo.name,
                removalPolicy: RemovalPolicy.RETAIN,
                encryption: s3.BucketEncryption.UNENCRYPTED,

            });
        }
    }

    private async getS3Encriptions(client: any, bucketName: string) {
        const input = {Bucket: bucketName};
        const command = new GetBucketEncryptionCommand(input);
        try {
            return await client.send(command);
        } catch (err) {
            return err
        }

    }

    public static async checkIfExists(bucket: { "name": string, "exists": boolean }, region: string): Promise<any> {
        try {
            if (bucket.exists) {
                let client = new S3Client({region: region,retryMode:"adaptative"});
                const data = await client.send(new ListBucketsCommand({}));
                let isFound = false;
                const buckets: Array<any> = data.Buckets ? data.Buckets : [];
                if (buckets && buckets.length > 0) {
                    const isAvailable = buckets.filter((item) => item.Name == bucket.name);

                    isFound = isAvailable.length > 0 ? true : false;
                    console.log("BUCKET " + bucket.name + "found: " + isFound.toString());
                    if (isFound === false) return Promise.reject("not found bucket " + bucket.name)
                }
                return Promise.resolve(isFound)
            }
            return Promise.resolve(true)
        } catch (err) {
            console.log("Error", err);
            return Promise.reject(err)
        }
    }
}