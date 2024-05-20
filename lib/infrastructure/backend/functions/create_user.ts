import {Context} from "aws-lambda";
import {DynamoDBClient, GetItemCommand, PutItemCommand} from "@aws-sdk/client-dynamodb";
import {
    AdminAddUserToGroupCommand,
    CognitoIdentityProviderClient,
    DescribeUserPoolCommand
} from "@aws-sdk/client-cognito-identity-provider"


import { Ids, init, trace, Triggers } from "tool-audit-trail"

exports.create_user_in_database = async (
    event: any,
    context: Context,
    callback: any
) => {
    console.log(event);

    if (event.request.userAttributes.email) {
        const dbclient = new DynamoDBClient({region: "eu-west-1"});
        const cgclient = new CognitoIdentityProviderClient({region: "eu-west-1"})
        const date = Date.now().toString();
        const usersTable = process.env.DYNAMODB_TABLE_USERS
        const poolName = (await cgclient.send(new DescribeUserPoolCommand({UserPoolId: event.userPoolId}))).UserPool?.Name

        const user_pool = poolName === process.env.PRO_POOL_NAME ? "USER" : "CONSUMER"

        const PRE = user_pool + "#";

        // async/await.
        try {
            const userName = PRE + event.request.userAttributes.sub
            const params: any = {
                TableName: usersTable,
                Key: {
                    PK: {S: userName},
                    SK: {S: userName}
                }
            }

            const getUserCommand = new GetItemCommand(params);
            const getUser: any = await dbclient.send(getUserCommand);
            console.log(getUser);
            if (getUser.Item) {
                console.log("User Already exists")
            } else {
                const dynamoInput = {
                    TableName: usersTable,
                    Item: {
                        PK: {S: userName},
                        SK: {S: userName},
                        createdAt: {N: date},
                        email: {S: event.request.userAttributes.email},
                        name: {
                            M: {
                                firstName: {S: event.request.userAttributes.given_name ?? ""},
                                lastName: {S: event.request.userAttributes.family_name ?? ""}
                            }
                        },
                        preferences: {
                            "M": {
                                "notifications": {
                                    "M": {
                                        "information": {
                                            "M": {
                                                "email": {
                                                    "BOOL": false
                                                },
                                                "push": {
                                                    "BOOL": false
                                                }
                                            }
                                        },
                                        "productNews": {
                                            "M": {
                                                "email": {
                                                    "BOOL": false
                                                },
                                                "push": {
                                                    "BOOL": false
                                                }
                                            }
                                        },
                                        "recommendations": {
                                            "M": {
                                                "email": {
                                                    "BOOL": false
                                                },
                                                "push": {
                                                    "BOOL": false
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                        }
                    },
                };
                const userGroupInput = {
                    UserPoolId: event.userPoolId,
                    Username: event.request.userAttributes.sub,
                    GroupName: poolName === process.env.PRO_POOL_NAME ? "customer" : "consumer"
                }

                const dynamoCommand = new PutItemCommand(dynamoInput);
                const cognitoCommand = new AdminAddUserToGroupCommand(userGroupInput)
                await Promise.all([dbclient.send(dynamoCommand), cgclient.send(cognitoCommand)])
            }


            await trace(init({
                date: new Date(),
                project: process.env.AUDIT_TRAIL_PROJECT_NAME!,
                sessionId: PRE + event.userName, //No session id here
                userId: PRE + event.userName,
                actionId: Ids.ATTRIBUTE_UPDATE,
                actionTrigger: event.triggerSource === 'PostAuthentication_Authentication' ? Triggers.COGNITO_LOGIN : Triggers.COGNITO_SIGNUP,
                senderId: event.userPoolId,
                senderEntity: PRE + "COGNITO",
                recipientId: PRE + event.userName,
                recipientEntity: user_pool,
                valueNew: {},
                metadata: {
                    request: event.request,
                    userPoolId : event.userPoolId
                },
                agent: event.callerContext.clientId,
            })); 

            // process data.
        } catch (error) {
            // error handling.
            console.log(error);
        } finally {
            // finally.
        }

        callback(null, event);
    } else {
        callback(null, event);
    }
};
