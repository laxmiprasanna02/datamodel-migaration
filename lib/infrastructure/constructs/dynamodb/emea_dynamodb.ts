process.env.AWS_MAX_ATTEMPTS="20"
import {CfnOutput, RemovalPolicy} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { StreamViewType, Table } from "aws-cdk-lib/aws-dynamodb";
import {
  DynamoDBClient,
  DescribeTableCommand,
  ListTablesCommand,
  DescribeTimeToLiveCommand,
} from "@aws-sdk/client-dynamodb"; // ES Modules
import { compareArray } from "../../shared/policyActions";
import { ListStreamsCommand, DynamoDBStreamsClient} from "@aws-sdk/client-dynamodb-streams";
const client = new DynamoDBClient({ region: process.env.CDK_DEFAULT_REGION,retryMode: "adaptive"
});

export class EmeaDynamoDB extends Construct {
  construct_id: string;
  table: dynamodb.Table;

tableInfo:{ exists: boolean; name: string; props?:{gsi?:any,ttl?:any,stream?:any} };
  constructor(
    scope: Construct,
    stack_id: string,
    tableobj: { exists: boolean; name: string; props?:{gsi?:any,ttl?:any,stream?:any} }
  ) {


    const construct_id = stack_id + "-" + tableobj.name;
    super(scope, construct_id);
    this.tableInfo=tableobj
    this.construct_id = construct_id;
    const dynamos_removal_policy = RemovalPolicy.RETAIN;
    const dynamos_write_capacity = 1;
    const dynamos_read_capacity = 1;

    let gsi= tableobj.props?.gsi
    const ttl=tableobj.props?.ttl
    const streamViewType=tableobj.props?.stream

    if (!tableobj.exists) {
      var table = new dynamodb.Table(this, this.construct_id + "-table", {
        tableName: tableobj.name,
        partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
        sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
        removalPolicy: dynamos_removal_policy,
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        //readCapacity: dynamos_read_capacity,
        //writeCapacity: dynamos_write_capacity,
        timeToLiveAttribute: ttl,
        stream: streamViewType,
      });

      if (gsi != undefined) {
        if (typeof gsi === "string") gsi = [gsi]; //Work with lists in case there are other GSIs in the same table
        for (var index of gsi) {
          let pkindex = undefined;
          let skindex = undefined;
          if (typeof index === "string") pkindex = index;
          else if (index.pk) {
            pkindex = index.pk;
            skindex = { name: index.sk, type: dynamodb.AttributeType.STRING };
          }

          if (pkindex)
            table.addGlobalSecondaryIndex({
              //readCapacity: dynamos_read_capacity, writeCapacity: dynamos_write_capacity,
              indexName: pkindex + "-index",
              partitionKey: {
                name: pkindex,
                type: dynamodb.AttributeType.STRING,
              },
              sortKey: skindex,
              projectionType: dynamodb.ProjectionType.ALL,
            });
        }
      }
      this.table = table;
    }


  }

  public static async validateTable(table: any, region: string): Promise<any> {
    try {
      if (table.exists) {
        let isValid = true;
        const command = new DescribeTableCommand({ TableName: table.name });
        const describeData = await client.send(command);

        // Table status 
        if(describeData.Table?.TableStatus !="ACTIVE"){
          return Promise.reject("Table is not Active " + table.name);
        }

        const keySchema = [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' }
        ]

        // Validate key schema
        if(JSON.stringify(describeData.Table.KeySchema) != JSON.stringify(keySchema)){
          return Promise.reject("Key schema not valid " + table.name);
        }
        
        // validate GSI
        if (table.props && table.props.gsi) {
          console.log("validate table" + table.name);
          if (
            describeData.Table &&
            describeData.Table?.GlobalSecondaryIndexes?.length &&
            describeData.Table?.GlobalSecondaryIndexes?.length > 0
          ) {

            const GSIkeys = describeData.Table?.GlobalSecondaryIndexes.map(
              (item:any) => item.IndexName
            );
            const tableGSI: any = [];
            table.props.gsi.forEach((item: any) => {
              if (typeof item === "string"){
                tableGSI.push(item+'-index')
              }else if (item.pk) {
                tableGSI.push(item.pk+'-index');
              }
            });

            if (!compareArray(tableGSI,GSIkeys)) {
              return Promise.reject(
                "GlobalSecondaryIndexes not match " + table.name
              );
            }

          } else {
            return Promise.reject(
              "Not found GlobalSecondaryIndexes " + table.name
            );
          }
         
        }

         // Validate stream
         if (table.props && table.props.stream) {
          if (
            (describeData.Table &&
              !describeData.Table.StreamSpecification?.StreamEnabled) ||
            (describeData.Table &&
              describeData.Table.StreamSpecification?.StreamViewType !==
                table.props.stream)
          ) {
            return Promise.reject("not found stream " + table.name);
          }
          const commandStream = new ListStreamsCommand({ TableName: table.name })
           const streamsClient = new DynamoDBStreamsClient({ region: process.env.CDK_DEFAULT_REGION,retryMode: "adaptive"
           });
           const describeStreamData = await streamsClient.send(commandStream);
          if(!describeStreamData.Streams || !describeStreamData.Streams[0].StreamArn) {

            return Promise.reject("not found stream " + table.name);
          }
        }

        // validate billing mode 
        if(describeData.Table?.BillingModeSummary?.BillingMode !="PAY_PER_REQUEST"){
          return Promise.reject("Billing mode should be PAY_PER_REQUEST " + table.name);
        }

        // Validate Time to live
        if (table.props && table.props.ttl) {
          const command = new DescribeTimeToLiveCommand({
            TableName: table.name,
          });
          const describeTTL = await (
            await client.send(command)
          ).TimeToLiveDescription;
          if (
            describeTTL?.TimeToLiveStatus != "ENABLED" ||
            describeTTL.AttributeName !== table.props.ttl
          ) {
            return Promise.reject("not found TTL " + table.name);
          }
        }
        return Promise.resolve(isValid);
      }
      return Promise.resolve(true);
    } catch (err) {
      console.log("Error", err);
      return Promise.reject(err);
    }
  }
}
