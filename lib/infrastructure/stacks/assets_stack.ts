import {CfnOutput, RemovalPolicy, Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {EmeaDynamoDB} from '../constructs/dynamodb/emea_dynamodb'
import {EmeaTimestream} from '../constructs/timestream/emea_timestream';
import {EmeaS3} from "../constructs/s3/emea_s3";
import {EmeaCognito} from "../constructs/cognito/emea_cognito";
import {EmeaCloudFront} from "../constructs/cloudfront/emea_cloudfront";
import {AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId} from 'aws-cdk-lib/custom-resources';
import {DynamoDBStreamsClient, ListStreamsCommand} from "@aws-sdk/client-dynamodb-streams";

export class AssetsStack extends Stack {
    cogPools:{name:string,pool:EmeaCognito}[]=[];
    dynamodbTables:EmeaDynamoDB[]
    constructor(scope: Construct, stack_id: string, tags: any, props?: StackProps) {

        super(scope, stack_id, props);

        // Dynamos (Naming convention for Dynamos: EU-[stage]-[use])
        this.dynamodbTables=[]
        this.dynamodbTables.push(new EmeaDynamoDB(this, stack_id + '-dynamo', tags['dynamoDbs']['users']))
        this.dynamodbTables.push(new EmeaDynamoDB(this, stack_id + '-dynamo', tags['dynamoDbs']['userEmailHistory']))
        this.dynamodbTables.push(new EmeaDynamoDB(this, stack_id + '-dynamo', tags['dynamoDbs']['accounts']))
        this.dynamodbTables.push(new EmeaDynamoDB(this, stack_id + '-dynamo', tags['dynamoDbs']['pools']))
        this.dynamodbTables.push(new EmeaDynamoDB(this, stack_id + '-dynamo', tags['dynamoDbs']['legalDocuments']))
        this.dynamodbTables.push(new EmeaDynamoDB(this, stack_id + '-dynamo', tags['dynamoDbs']['devices']))
        this. dynamodbTables.push(new EmeaDynamoDB(this, stack_id + '-dynamo', tags['dynamoDbs']['alerts']))
        this.dynamodbTables.push(new EmeaDynamoDB(this, stack_id + '-dynamo', tags['dynamoDbs']['configFiles']))
        this.dynamodbTables.push(new EmeaDynamoDB(this, stack_id + '-dynamo', tags['dynamoDbs']['wsConnectedClients']))
        this.dynamodbTables.push(new EmeaDynamoDB(this, stack_id + '-dynamo', tags['dynamoDbs']['wsSubscriptions']))
        this.dynamodbTables.push(new EmeaDynamoDB(this, stack_id + '-dynamo', tags['dynamoDbs']['offlineShadows']))
        this.dynamodbTables.push(new EmeaDynamoDB(this, stack_id + '-dynamo', tags['dynamoDbs']['assistantJobs']))
        /* Deleted accounts tables */
        this.dynamodbTables.push(new EmeaDynamoDB(this, stack_id + '-dynamo', tags['dynamoDbs']['archiveUsers']))
        this.dynamodbTables.push(new EmeaDynamoDB(this, stack_id + '-dynamo', tags['dynamoDbs']['archivePools']))

        new EmeaS3(this, stack_id + '-s3', tags['s3Buckets']['documents'], tags["pipeline_region"])

        new EmeaS3(this, stack_id + '-s3-cfs', tags['s3Buckets']['configFiles'], tags["pipeline_region"])
        new EmeaS3(this, stack_id + '-s3-iotr', tags['s3Buckets']['ruleErrors'], tags["pipeline_region"])
        new EmeaS3(this, stack_id + '-s3-ota', tags['s3Buckets']['otaFiles'], tags["pipeline_region"])
        new EmeaS3(this, stack_id + '-s3-translations', tags['s3Buckets']['translations'], tags["pipeline_region"])
        new EmeaS3(this, stack_id + '-s3-assistant-jobs', tags['s3Buckets']['algorithmJobs'], tags["pipeline_region"])





        this.cogPools.push({name:"PRO",pool:new EmeaCognito(this, stack_id + '-fluidrapro-pool', tags,false, "PRO")})
        this.cogPools.push({name:"IAQ",pool:new EmeaCognito(this, stack_id + '-fluidrapro-pool', tags, true, "IAQ")})

        // Timestream (Naming convention for Dynamos: EU-[stage]-[use])
        new EmeaTimestream(this, stack_id + '-timestream', tags['timestreams']['telemetry'], tags["pipeline_region"], tags['s3Buckets']['magneticErrors'])
        new EmeaTimestream(this, stack_id + '-timestream-audit-trail', tags['timestreams']['auditTrail'], tags["pipeline_region"])
        new EmeaTimestream(this, stack_id + '-timestream-assistant-jobs', tags['timestreams']['assistantJobs'], tags["pipeline_region"], tags['s3Buckets']['magneticErrors'])

        // Cloudfront-s3 solution for Privacy Policy and legal terms

        const legalFilesBucket = new EmeaS3(this, stack_id + '-s3-lfs', tags['s3Buckets']['legalFiles'], tags["pipeline_region"])
        if (legalFilesBucket.bucket === undefined) throw new Error("Legal files bucket not found")
        new EmeaCloudFront(this, stack_id + '-cloudfront', tags['CLOUDFRONT_LEGAL_FILES'], legalFilesBucket.bucket)




        const getIoTEndpoint = new AwsCustomResource(this, 'IoTDataEndpoint', {
            onCreate: {
                service: 'Iot',
                action: 'describeEndpoint',
                physicalResourceId: PhysicalResourceId.fromResponse('endpointAddress'),
                parameters: {
                    "endpointType": "iot:Data-ATS"
                }
            },
            policy: AwsCustomResourcePolicy.fromSdkCalls({resources: AwsCustomResourcePolicy.ANY_RESOURCE})
        });
        const getIoTJobsEndpoint = new AwsCustomResource(this, 'IoTJobEndpoint', {
            onCreate: {
                service: 'Iot',
                action: 'describeEndpoint',
                physicalResourceId: PhysicalResourceId.fromResponse('endpointAddress'),
                parameters: {
                    "endpointType": "iot:Jobs"
                }
            },
            policy: AwsCustomResourcePolicy.fromSdkCalls({resources: AwsCustomResourcePolicy.ANY_RESOURCE})
        });

        const IOT_ENDPOINT = getIoTEndpoint.getResponseField('endpointAddress')
        const IOT_JOBS_ENDPOINT = getIoTJobsEndpoint.getResponseField('endpointAddress')



        new CfnOutput(this,tags['stage']+'AwsIoTDataEndpoint' , { value: IOT_ENDPOINT,exportName:tags['stage']+'AwsIoTDataEndpoint' });
        new CfnOutput(this,tags['stage']+'AwsIoTJobsEndpoint' , { value: IOT_JOBS_ENDPOINT,exportName:tags['stage']+'AwsIoTJobsEndpoint' });

    }
    public async assignOutputs(tags: any) {
        for(const time in tags['timestreams']) {
            const name=tags['stage']+'PlatformDataModelAssetsTimestream'+time.charAt(0).toUpperCase() + time.slice(1)
            new CfnOutput(this,name , { value: tags['timestreams'][time]['name'],exportName:name });
        }
        for(const cogPool of this.cogPools) {
            const name=tags['stage']+'PlatformDataModelAssetsCognitoPool'+cogPool.name.charAt(0).toUpperCase() + cogPool.name.slice(1)
            new CfnOutput(this,name , { value: cogPool.pool.pool.userPoolId,exportName:name });
            const poolname=tags['stage']+'PlatformDataModelAssetsCognitoPool'+cogPool.name.charAt(0).toUpperCase() + cogPool.name.slice(1)+"Name"
            new CfnOutput(this,poolname , { value: cogPool.pool.poolName,exportName:poolname });
        }
        for(const bucket in tags['s3Buckets']) {
            const name=tags['stage']+'PlatformDataModelAssetsS3'+bucket.charAt(0).toUpperCase() + bucket.slice(1)
            new CfnOutput(this, name, { value: tags['s3Buckets'][bucket]['name'] ,exportName:name });
        }
        for(const dynamo in tags['dynamoDbs']) {
            const name=tags['stage']+'PlatformDataModelAssetsDynamodb'+ dynamo.charAt(0).toUpperCase() + dynamo.slice(1)
            new CfnOutput(this,name, { value: tags['dynamoDbs'][dynamo]['name']  ,exportName:name });







        }
        for (const table of this.dynamodbTables){


            for (const key in tags['dynamoDbs']){
                if(tags['dynamoDbs'][key].name===table.tableInfo.name)
                {

                    if(!table.tableInfo.exists && table.table?.tableStreamArn && table.tableInfo.props?.stream) {
                        const name = tags['stage'] + 'PlatformDataModelAssetsDynamodbStream' + key.charAt(0).toUpperCase() + key.slice(1)
                        new CfnOutput(this, name, {value: table.table?.tableStreamArn, exportName: name});
                    }
                    else if (table.tableInfo.exists && table.tableInfo.props?.stream ){
                        const commandStream = new ListStreamsCommand({ TableName:table.tableInfo.name})
                        const streamsClient = new DynamoDBStreamsClient({ region: process.env.CDK_DEFAULT_REGION,retryMode: "adaptive"
                        });
                        const describeStreamData = await streamsClient.send(commandStream);
                        console.log(JSON.stringify(describeStreamData))
                        if(describeStreamData.Streams && describeStreamData.Streams.length>0 && describeStreamData.Streams[0].StreamArn) {
                            const streamArn = describeStreamData.Streams[0].StreamArn
                            const cdkVarName= key.charAt(0).toUpperCase() + key.slice(1)
                            const name = tags['stage'] + 'PlatformDataModelAssetsDynamodbStream' +cdkVarName
                            new CfnOutput(this, name, {value: streamArn, exportName: name});
                        }

                    }
                }
            }

        }

        return Promise.resolve();

    }
    public static async checkExistingResources(tags: any,scope:Construct) {

        /* validate timestream */
        for(const time in tags['timestreams']) {
            await EmeaTimestream.validate(tags['timestreams'][time],tags["pipeline_region"])

        }

        for(const pool in tags['cognitoPools']) {
            await EmeaCognito.validateUserPool(tags['cognitoPools'][pool], tags["pipeline_region"])
        }

        for(const bucket in tags['s3Buckets']) {
            await EmeaS3.checkIfExists(tags['s3Buckets'][bucket], tags["pipeline_region"])
        }
        for(const dynamo in tags['dynamoDbs']) {
            await EmeaDynamoDB.validateTable(tags['dynamoDbs'][dynamo],tags["pipeline_region"])
        }
    }
}
