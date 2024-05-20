
from faker import Faker
import os
import json
import decimal
from objectpath import *
import random
import os
import boto3
import argparse
DATA_OBJECTS_DIR='data_objects'

STAGE = None

CONF= None




def put_dynamodb_objects(table_name,objects):
    dynamodb = boto3.resource('dynamodb',region_name=CONF["region"])
    table = dynamodb.Table(table_name)
    with table.batch_writer() as batch:
        for object in objects:
            batch.put_item(Item=object)

def put_timestream_objects(database_name,table_name,table_structure,objects):
    timestream_client = boto3.client('timestream-write',region_name=CONF["region"])
    database = database_name
    table = table_name
    records=[]
    for object in objects:
        dimensions = []
        measures=[]
        for dimension in table_structure["dimension_attrs"]:
            dimensions.append({'Name': dimension, 'Value': str(object[dimension])})


        measures.append({"Name": table_structure["measure_value_name"],
                         "Value": str(object[ table_structure["measure_value_attr"]]),
                         "Type": table_structure["measure_value_type"]})
        measure_name=str(object[table_structure["measure_name_attr"]])
        timestamp=str(object[table_structure["time_attr"]])
        record = {
            'Dimensions': dimensions,
            'MeasureName': measure_name,
            'MeasureValues': measures,
            'Version': 1,
            'MeasureValueType': 'MULTI',
            'TimeUnit': table_structure["time_unit"],
            'Time': timestamp
        }
        records.append(record)
    try:
        res=timestream_client.write_records(DatabaseName=database, TableName=table,
                                                 Records=records, CommonAttributes={})
        print("WriteRecords Status: [%s]" % res['ResponseMetadata']['HTTPStatusCode'])
    except timestream_client.exceptions.RejectedRecordsException as err:
        print("RejectedRecords: ", err)
        for rr in err.response["RejectedRecords"]:
            print(json.dumps(records[rr["RecordIndex"]]))
            print("Rejected Index " + str(rr["RecordIndex"]) + ": " + rr["Reason"])
        print("Other records were written successfully. ")
    except Exception as err:
        print("Error:", err)


def delete_dynamodb_items(table_name,primary_keys):
    dynamodb = boto3.resource('dynamodb', region_name=CONF["region"])
    table = dynamodb.Table(table_name)
    scan = table.scan()
    flag=False
    while not flag:
        with table.batch_writer() as batch:
            for each in scan['Items']:
                key_elem={}
                for key in primary_keys:
                    key_elem[key]=each[key]
                batch.delete_item(
                    Key=key_elem
                )
            flag = True

if __name__ == '__main__':

    faker = Faker()
    data_objects=[]
    for root, dirs, files in os.walk(DATA_OBJECTS_DIR):
        for file in files:
            filename,extension=os.path.splitext(file)
            if '.json' == extension:
                data_objects.append(file)
    insert_data={}

    parser = argparse.ArgumentParser()
    parser.add_argument("-s","--stage",default="dev",help="deployment stage")
    parser.add_argument("--destroy", action="store_true", help="Delete database objects")
    args = parser.parse_args()
    STAGE=args.stage
    destroy=args.destroy
    print("STAGE "+STAGE)

    if STAGE is None:
        STAGE = "dev"
    CONF = json.load(open("stage/" + STAGE + ".json"))


    aws_account_id = boto3.client('sts').get_caller_identity().get('Account')
    print("logged account id " + aws_account_id)
    print("stage account id "+ CONF["accountId"])
    if aws_account_id != CONF["accountId"]:
        print("Youre not logged in the stage account id")
        exit(0)


    print("DATA OBJECTS")
    print(json.dumps(data_objects))
    while data_objects != []:
        for data_object in data_objects:
            fake_object={
                'name':'',
                'objects':[],
                'relations':[],
                'create_entity':False
            }
            f = open(DATA_OBJECTS_DIR+'/'+data_object)
            data=json.load(f)
            dep_array=[]
            if destroy == True:
                if data["db"]["type"] == "dynamodb":
                    delete_dynamodb_items(CONF["dynamodbTableConfig"][data["db"]["alias"]]["name"],data["primary_keys"])
                data_objects.remove(data_object)
            else:
                for dependency in data['dependencies']:
                    if dependency not in insert_data:
                        dep_array.append(dependency)
                if len(dep_array)>0:
                    continue
                print("-------FILE " + data_object+" --------")
                data_objects.remove(data_object)
                insert_data[data['name']]=data
                insert_data[data['name']]["objects"]=[]
                insert_data[data['name']]["hashes"]=[]
                for argument in data["fakerArguments"]:
                    key=list(argument.keys())[0]
                    faker.set_arguments(key, argument[key])

                for object_i in range(CONF["number_of_objects"][data['name']]):
                    json_out=faker.json(data_columns=data["dataObject"])
                    data_output_object=json.loads(json_out)[0]
                    random_num = random.random() * 100
                    for key, value in data_output_object.items():
                        if (type(value) == str) and value.startswith('reference:'):

                            path=data_output_object[key].split("reference:")[1].format(randomNumber=random_num)
                            tree = Tree(insert_data)
                            elem=tree.execute(path)
                            data_output_object[key]=elem

                        if (type(value) == str) and value.startswith('###'):
                            data_output_object[key]=data_output_object[data_output_object[key].split("###")[1]]
                    if  len(data["primary_keys"])>0:
                        pk = ""
                        for key in data["primary_keys"]:
                            pk+=data_output_object[key]

                        if pk not in insert_data[data['name']]["hashes"]:
                            insert_data[data['name']]["objects"].append(data_output_object)
                            insert_data[data['name']]["hashes"].append(pk)
                    else:
                        insert_data[data['name']]["objects"].append(data_output_object)
    #print(json.dumps(insert_data, indent=4, sort_keys=True))

    if destroy == False:
        for key, value in insert_data.items():
            db_type=value["db"]["type"]

            if db_type == "dynamodb":
                put_dynamodb_objects(CONF["dynamodbTableConfig"][value["db"]["alias"]]["name"], value["objects"])
            if db_type == "timestream":

                put_timestream_objects(CONF["timestreamConfig"][value["db"]["alias"]]["database"], CONF["timestreamConfig"][value["db"]["alias"]]["table"],value["db"]["structure"],value["objects"])
    else:
        print("REMEMBER we can't delete AWS TIMESTREAM records")

