# Fluidra data generator

Script for generating dummy data in Fluidra databases

## Installation

This script runs under python3 and first of all, you need to install the dependencies.


```bash
$ pip install -r requirements.txt
```


## Usage
The script will use the AWS account that is configured by default in the shell. To modify that account you will have to set the environment variables AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_SESSION_TOKEN (if we use SSO).

```bash
$ python3 main.py -h      
usage: main.py [-h] [-s STAGE] [--destroy]

optional arguments:
  -h, --help            show this help message and exit
  -s STAGE, --stage STAGE
                        deployment stage
  --destroy             Delete database objects

```

## Examples

Example: deploy data on dev stage:
```bash
$ python3 main.py -s dev
```

Example: Destroy Dynamodb's data (*CAUTION:* This action deletes all db entries):

```bash
$ python3 main.py -s dev --destroy
```

## Configuration
In the "stage" folder are the configuration files related to every deployment stage (don't add production stages) like this:
```json
{
  "stage": "dev",
  "accountId": "156696388136",
  "region": "eu-west-1",
  "dynamodbTableConfig": {
    "user": {"name": "EU-dev-platform-users"},
    "pool": {"name": "EU-dev-platform-pools" },
    "legaldocument": {"name": "EU-dev-platform-legal-documents" },
    "device": {"name": "EU-dev-platform-devices" },
    "alert": {"name": "EU-dev-platform-alerts" },
    "configfile": {"name": "EU-dev-platform-config-files" },
    "deviceconfigfile": {"name": "EU-dev-platform-device-config-files"}
  },
  "timestreamConfig":{
      "sensortelemetry": {"table": "sensor_values","database": "EU-dev-platform-telemetry"}
  },
  "number_of_objects": {
    "alert": 50,
    "configfile": 50,
    "device": 50,
    "deviceconfigfile": 50,
    "devicedigitalsensor": 50,
    "legaldocument": 50,
    "phone": 50,
    "pool": 50,
    "pooldevice": 50,
    "poolsharingcode": 50,
    "sensortelemetry": 50,
    "user": 50,
    "userlegaldocument": 50,
    "userpool": 2
  }
}
```