import {RemovalPolicy} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as timestream from 'aws-cdk-lib/aws-timestream';
import {EmeaS3} from "../s3/emea_s3";
import {DescribeTableCommand, TimestreamWriteClient} from "@aws-sdk/client-timestream-write";

export class EmeaTimestream extends Construct{
    construct_id: string
    database: timestream.CfnDatabase
    tables: Array<timestream.CfnTable>
    
    constructor(scope:Construct, stack_id:string, database: {name:string,exists:boolean , table_names:{ name:string,details:any }[]} ,region:string,magnetic_error_bucketname:(any|undefined)=undefined){
        var construct_id = stack_id+'-'+database.name
        super(scope, construct_id)
        this.construct_id = construct_id
        if(!database.exists) {
            const timestream_removal_policy = RemovalPolicy.RETAIN
            const timestream_retention_memory_hours = 24 * 7
            const timestream_retention_magnetic_days = 365 * 200

            // Database
            var db = new timestream.CfnDatabase(this, this.construct_id + '-database', {
                databaseName: database.name

            })
            db.applyRemovalPolicy(timestream_removal_policy)

            // Tables
            var tables: Array<timestream.CfnTable> = []
            for (var table_to_create of database.table_names) {
                var table = new timestream.CfnTable(this, this.construct_id + '-' + table_to_create + '-table', {
                    databaseName: database.name,
                    tableName: table_to_create.name,
                    retentionProperties: table_to_create.details
                })
                if (magnetic_error_bucketname != undefined) //enable Magnetic writes if needed
                    this._enable_magnetic_writes(table, magnetic_error_bucketname, timestream_removal_policy,region)
                table.applyRemovalPolicy(timestream_removal_policy)
                table.addDependsOn(db)
                tables.push(table)
            }

            this.database = db
            this.tables = tables
        }
        else{
            //sync code here

        }
    }

    _enable_magnetic_writes(table:timestream.CfnTable, bucket:any, bucket_removal_policy:RemovalPolicy,region:string): void{
        new EmeaS3(this,this.construct_id+'-'+bucket.name+'-timestream-magnetic-error-bucket',bucket,region)

        
        table.addPropertyOverride('MagneticStoreWriteProperties',
        {
            "EnableMagneticStoreWrites":true,
            "MagneticStoreRejectedDataLocation":{
                "S3Configuration":{
                    "BucketName":bucket.name,
                    "EncryptionOption":"SSE_S3",
                }
            }
        })
    }

    public static async validate(databse: { "name": string, "exists": boolean, table_names:(Array<any>) }, region: string): Promise<any> {
        try {
            if (databse.exists) {
                console.log("Validate time stream "+ databse.name);
                const writeClient = new TimestreamWriteClient({ region: region });
                let isFound = true;

                for (const element of databse.table_names) {
                    const item = element;

                    const params = {
                        DatabaseName: databse.name,
                        TableName: item.name
                    };
                    try {
                        const tableDetails = await writeClient.send(new DescribeTableCommand(params));

                        if(tableDetails.Table?.TableStatus != 'ACTIVE'){
                            return Promise.reject("Time stram table not active " + databse.name);
                        }

                        if(tableDetails.Table?.RetentionProperties?.MemoryStoreRetentionPeriodInHours !=item.details.MemoryStoreRetentionPeriodInHours){
                            return Promise.reject("timestream_retention_memory_hours " + databse.name);
                        }

                        if(tableDetails.Table?.RetentionProperties?.MagneticStoreRetentionPeriodInDays != item.details.MagneticStoreRetentionPeriodInDays){
                            return Promise.reject("timestream_retention_magnetic_days " + databse.name);
                        }
                    } catch (error) {
                        console.log("Timestream table details Error", error);
                        return Promise.reject(error)
                    }
                    
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