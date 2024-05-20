import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.job import Job
import os
args = getResolvedOptions(sys.argv, ["JOB_NAME","GLUE_TABLE_NAME","OUTPUT_BUCKET","TABLE_NAME","DATABASE_NAME"])
sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args["JOB_NAME"], args)
print ("The day partition key is: ", args["GLUE_TABLE_NAME"])
# Script generated for node JDBC Connection
JDBCConnection_node1 = glueContext.create_dynamic_frame.from_catalog(
    database=args["DATABASE_NAME"],
    table_name=args["GLUE_TABLE_NAME"],
    transformation_ctx="JDBCConnection_node1",
)

# Script generated for node S3 bucket
S3bucket_node3 = glueContext.write_dynamic_frame.from_options(
    frame=JDBCConnection_node1,
    connection_type="s3",
    format="json",
    connection_options={
        "path": "s3://"+ args["OUTPUT_BUCKET"]+ "/" + args["TABLE_NAME"]+"/",
        "partitionKeys": [],
    },
    transformation_ctx="S3bucket_node3",
)

job.commit()
