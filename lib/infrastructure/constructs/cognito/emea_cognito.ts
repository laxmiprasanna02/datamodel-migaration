import { Construct } from 'constructs';
import { Duration, RemovalPolicy, aws_cognito as cognito, aws_lambda as lambda } from 'aws-cdk-lib';
import {
  CfnUserPoolIdentityProviderProps,
  ClientAttributes,
  ICustomAttribute,
  Mfa,
  OAuthScope,
  StandardAttributesMask,
  StringAttribute
} from "aws-cdk-lib/aws-cognito";
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { join } from 'path';
import * as iam from 'aws-cdk-lib/aws-iam';
import {cwd} from "process";
import {Function, LayerVersion, Tracing} from "aws-cdk-lib/aws-lambda";
import { CognitoIdentityProviderClient, DescribeUserPoolCommand, ListGroupsCommand } from "@aws-sdk/client-cognito-identity-provider"; // ES Modules import
import { compareArray } from '../../shared/policyActions';

export class EmeaCognito extends Construct {
    construct_id: string
    pool: cognito.UserPool
    poolName: string

    constructor(scope: Construct, stackId: string, tags: any,signUpEnabled=false, cognitoType: string) {
        const poolName = tags['cognitoPools'][cognitoType]['poolName'];
        const triggersLambdaArn = tags['cognitoPools'][cognitoType]['poolLambdaTriggerArn'];
        const userCreateLambdaArn = tags['cognitoPools'][cognitoType]['userCreateTriggerArn'];
        const SES = tags['cognitoPools'][cognitoType]['SES'];
        const callbackUrls = tags['cognitoPools'][cognitoType]["callbackUrls"];
        const domainPrefix = tags['cognitoPools'][cognitoType]["cognitoDomainPrefix"];
        const groups:Array<any> = tags['cognitoPools'][cognitoType]["groups"];
        const identityProviders: any[] = tags["cognitoPools"][cognitoType]["identityProviders"];
        const cleanedPoolName= poolName.toLowerCase().replace(" ", "-").replace("+", "");
        var construct_id = stackId + '-' + cleanedPoolName
        super(scope, construct_id)
        this.construct_id = construct_id
/*        const openTelemetryLayer=LayerVersion.fromLayerVersionArn(this,construct_id + '-lambda-otel-layer',"arn:aws:lambda:eu-west-1:901920570463:layer:aws-otel-nodejs-amd64-ver-1-7-0:1");
       const create_user = new NodejsFunction(
            this,
            "create_cognito_user",
            {
                runtime: lambda.Runtime.NODEJS_14_X,
                entry: join(__dirname, "..", "..", "backend", "functions", "create_user.ts"),
                handler: "create_user_in_database",
                depsLockFilePath: join(__dirname, "..", "..", 'backend', 'package-lock.json'),
                tracing: Tracing.ACTIVE,
                layers:[openTelemetryLayer],

                functionName: `EU-${tags.awsiot_region}-${tags.stage}-${cleanedPoolName}-create_cognito_user`,
                environment: {
                    DYNAMODB_TABLE_USERS: tags["dynamoDbs"]["users"].name,
                    PRO_POOL_NAME: tags['cognitoPools']['PRO']["poolName"],
                    AUDIT_TRAIL_PROJECT_NAME : tags["AUDIT_TRAIL"]["PROJECT_NAME"],
                    AUDIT_TRAIL_DEFAULT_SQS_URL : tags["AUDIT_TRAIL"]["SQS_URL"],
                },
                bundling: {
                    forceDockerBundling: true,
                    minify: true,
                    sourceMap: true,
                    loader: { '.yaml': 'file' },
                    externalModules: ['aws-sdk','sqlite3', 'pg-native','pg-query-stream', 'mssql', 'mssql/lib/base', 'mssql/package.json', 'mysql', 'mysql2', 'oracle', 'oracledb', 'tedious', 'better-sqlite3', "mock-aws-s3", "nock"], //Knex unnecessary libraries
                    target: 'es2020',
                    commandHooks: {
                        beforeBundling(inputDir: string, outputDir: string): string[] {
                            return [`cp -RL ${inputDir}/assets ${outputDir} 2>/dev/null || :`];
                        },
                        afterBundling(inputDir: string, outputDir: string): string[] {
                            return []
                        },
                        beforeInstall(inputDir: string, outputDir: string): string[] {
                            return []
                        }
                    }
                }
            }
        );
        // 👇 create a policy statement
        const dynamodb = new iam.PolicyStatement({
            actions: ["dynamodb:*", "cognito-idp:DescribeUserPool", "cognito-idp:AdminAddUserToGroup"],
            resources: [`arn:aws:dynamodb:*:*:table/${tags["dynamoDbs"]["users"].name}`,
            `arn:aws:cognito-idp:${tags["pipeline_region"]}:${tags["pipeline_account"]}:userpool/!*`],
        });

        const sqspolicy = new iam.PolicyStatement({
            actions: [
                "sqs:SendMessage",
                "sqs:GetQueueAttributes",
                "sqs:SendMessageBatch",
            ],
            resources: [tags["AUDIT_TRAIL"]["SQS_ARN"]],
        });
        // 👇 add the policy to the Function's role
        create_user.role?.attachInlinePolicy(
            new iam.Policy(this, 'dyna', {
                statements: [dynamodb,sqspolicy],
            }),
        );*/

        const passwordPolicy = tags['cognitoPools'][cognitoType]['Policies']['PasswordPolicy'];



        this.poolName=poolName

        const standardAttributes: StandardAttributesMask = {
            familyName: true,
            givenName: true,
            phoneNumber: true,
            email: true,
            locale: true,
        };
        const customAttributes: Record<string, ICustomAttribute> = {
            mfa_backup_code: new StringAttribute({ mutable: true }),
            accepted_documents: new StringAttribute({ mutable: true }),
            user_preferences: new StringAttribute({ mutable: true })
        }

        this.pool = new cognito.UserPool(
            this,
            this.construct_id + '-userpool',
            {
                userPoolName: poolName,
                selfSignUpEnabled: signUpEnabled,
                signInAliases: { username: false, email: true, phone: false },
                autoVerify: { email: true, phone: true },
                signInCaseSensitive: false,
                passwordPolicy: {
                    minLength: passwordPolicy.MinimumLength,
                    requireDigits: passwordPolicy.RequireNumbers,
                    requireLowercase: passwordPolicy.RequireLowercase,
                    requireUppercase: passwordPolicy.RequireUppercase,
                    requireSymbols: passwordPolicy.RequireSymbols,
                    tempPasswordValidity: Duration.days(passwordPolicy.TemporaryPasswordValidityDays),
                },

                deletionProtection:true,

                lambdaTriggers:{
                    createAuthChallenge:tags[`Cognito${cognitoType}CreateAuthChallenge`]?lambda.Function.fromFunctionArn(scope,`Cognito${cognitoType}CreateAuthChallengelambda`,tags[`Cognito${cognitoType}CreateAuthChallenge`]):lambda.Function.fromFunctionArn(scope,`Cognito${cognitoType}CreateAuthChallengelambda`,tags["cognitoPools"][cognitoType]["triggers"]["CreateAuthChallenge"]),
                    customMessage:tags[`Cognito${cognitoType}CustomMessage`]?lambda.Function.fromFunctionArn(scope,`Cognito${cognitoType}CustomMessage`,tags[`Cognito${cognitoType}CustomMessage`]):lambda.Function.fromFunctionArn(scope,`Cognito${cognitoType}CustomMessageambda`,tags["cognitoPools"][cognitoType]["triggers"]["CustomMessage"]),
                    defineAuthChallenge:tags[`Cognito${cognitoType}DefineAuthChallenge`]?lambda.Function.fromFunctionArn(scope,`Cognito${cognitoType}DefineAuthChallenge`,tags[`Cognito${cognitoType}DefineAuthChallenge`]):lambda.Function.fromFunctionArn(scope,`Cognito${cognitoType}DefineAuthChallengelambda`,tags["cognitoPools"][cognitoType]["triggers"]["DefineAuthChallenge"]),
                    postAuthentication:tags[`Cognito${cognitoType}PostAuthentication`]?lambda.Function.fromFunctionArn(scope,`Cognito${cognitoType}PostAuthentication`,tags[`Cognito${cognitoType}PostAuthentication`]):tags["cognitoPools"][cognitoType]["triggers"]["PostAuthentication"]?lambda.Function.fromFunctionArn(scope,`Cognito${cognitoType}PostAuthenticationlambda`,tags["cognitoPools"][cognitoType]["triggers"]["PostAuthentication"]):undefined,
                    postConfirmation:tags[`Cognito${cognitoType}PostConfirmation`]?lambda.Function.fromFunctionArn(scope,`Cognito${cognitoType}PostConfirmation`,tags[`Cognito${cognitoType}PostConfirmation`]):tags["cognitoPools"][cognitoType]["triggers"]["PostConfirmation"]?lambda.Function.fromFunctionArn(scope,`Cognito${cognitoType}PostConfirmationlambda`,tags["cognitoPools"][cognitoType]["triggers"]["PostConfirmation"]):undefined,
                    preAuthentication:tags[`Cognito${cognitoType}PreAuthentication`]?lambda.Function.fromFunctionArn(scope,`Cognito${cognitoType}PreAuthentication`,tags[`Cognito${cognitoType}PreAuthentication`]):lambda.Function.fromFunctionArn(scope,`Cognito${cognitoType}PreAuthenticationlambda`,tags["cognitoPools"][cognitoType]["triggers"]["PreAuthentication"]),
                    userMigration:tags[`Cognito${cognitoType}UserMigration`]?lambda.Function.fromFunctionArn(scope,`Cognito${cognitoType}UserMigration`,tags[`Cognito${cognitoType}UserMigration`]):lambda.Function.fromFunctionArn(scope,`Cognito${cognitoType}UserMigrationlambda`,tags["cognitoPools"][cognitoType]["triggers"]["UserMigration"]),
                    verifyAuthChallengeResponse:tags[`Cognito${cognitoType}VerifyAuthChallengeResponse`]?lambda.Function.fromFunctionArn(scope,`Cognito${cognitoType}VerifyAuthChallengeResponse`,tags[`Cognito${cognitoType}VerifyAuthChallengeResponse`]):lambda.Function.fromFunctionArn(scope,`Cognito${cognitoType}VerifyAuthChallengeResponselambda`,tags["cognitoPools"][cognitoType]["triggers"]["VerifyAuthChallengeResponse"])
                },
                accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
                customAttributes: customAttributes,
                email: cognito.UserPoolEmail.withSES(SES),
                mfa: Mfa.OPTIONAL,
                mfaSecondFactor: { otp: false, sms: true },
                removalPolicy: RemovalPolicy.RETAIN,
            },
        )
    // const appIdentityProviders: { [appClientNames: string]: {cfnIDPs: cognito.CfnUserPoolIdentityProvider[], supportedIDPs:cognito.UserPoolClientIdentityProvider[] } } = {};
    // if (identityProviders && identityProviders.length > 0) {
    //   for (const idp of identityProviders) {
    //     if (idp['type'].toUpperCase() === 'OIDC') {
    //       // const attributeMapping: { [attributes: string]: cognito.ProviderAttribute } = {};
    //       const attributeMapping: { [attributes: string]: string } = {};
    //       idp['attributeMapping']?.forEach((attributeMap: { destinyAttributeName: string, originAttributeName: string }) => {
    //         attributeMapping[attributeMap.destinyAttributeName] = attributeMap.originAttributeName;
    //                   // attributeMapping[attributeMap.destinyAttributeName] = cognito.ProviderAttribute.other(attributeMap.originAttributeName);
    //         });
    //         new cognito.CfnUserPoolIdentityProvider(
    //           this,
    //           this.construct_id + idp['name'] + idp['type'],
    //           {
    //             userPoolId: this.pool.userPoolId,
    //             providerName: idp['name'],
    //             providerType: idp['type'],
    //             providerDetails: {
    //               client_id: idp['clientId'],
    //               client_secret: idp['clientSecret'],
    //               oidc_issuer: idp['issuer'],
    //               attributes_request_method: cognito.OidcAttributeRequestMethod.GET,
    //               authorize_scopes: idp['scopes']?.join(" "),
    //             },
    //             attributeMapping: attributeMapping
    //           }
    //         );
    //         idp['userPoolClientNames']?.forEach((appClientName: string)=>{
    //           if (!appIdentityProviders[appClientName]) appIdentityProviders[appClientName] = {cfnIDPs:[], supportedIDPs:[]}
    //           appIdentityProviders[appClientName].cfnIDPs.push(idp)
    //           appIdentityProviders[appClientName].supportedIDPs.push(cognito.UserPoolClientIdentityProvider.custom(idp['name']))
    //         })
    //     }
    //   }
    // }
    const kaAppClient = this.pool.addClient(this.construct_id + 'ka-app', {
      // supportedIdentityProviders: appIdentityProviders['KA app']?.supportedIDPs,
      userPoolClientName: 'KA app',
      authFlows: {
        userPassword: true,
        adminUserPassword: true,
        custom: true,
        userSrp: true,
      },
      accessTokenValidity: Duration.minutes(5),
      idTokenValidity: Duration.minutes(5),
      refreshTokenValidity: Duration.days(1000),
      disableOAuth: false,
      generateSecret: false,
      preventUserExistenceErrors: true,
      oAuth: {
        callbackUrls: callbackUrls,
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [OAuthScope.OPENID, OAuthScope.COGNITO_ADMIN],
      },
      readAttributes: new ClientAttributes()
        .withStandardAttributes({
          ...standardAttributes,
          phoneNumberVerified: true
        })
        .withCustomAttributes(...Object.keys(customAttributes).slice(1)), //exclude mfa_backup_code
      writeAttributes: new ClientAttributes()
        .withStandardAttributes(standardAttributes)
        .withCustomAttributes(...Object.keys(customAttributes)),
    });
    // if (appIdentityProviders["Ka app"])
    //   kaAppClient.node.addDependency(appIdentityProviders["Ka app"].cfnIDPs)

    this.pool.addClient(this.construct_id + "mobile-app", {
      userPoolClientName: "Mobile app",
      authFlows: {
        userPassword: true,
        adminUserPassword: true,
        custom: true,
        userSrp: true,
      },
      accessTokenValidity: Duration.minutes(5),
      idTokenValidity: Duration.minutes(5),
      refreshTokenValidity: Duration.days(1000),
      disableOAuth: false,
      generateSecret: false,
      preventUserExistenceErrors: true,
      oAuth: {
        callbackUrls: callbackUrls,
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [OAuthScope.OPENID, OAuthScope.COGNITO_ADMIN],
      },
      readAttributes: new ClientAttributes()
        .withStandardAttributes({
          ...standardAttributes,
          phoneNumberVerified: true,
        })
        .withCustomAttributes(...Object.keys(customAttributes).slice(1)), //exclude mfa_backup_code
      writeAttributes: new ClientAttributes()
        .withStandardAttributes(standardAttributes)
        .withCustomAttributes(...Object.keys(customAttributes)),
    });
    this.pool.addDomain(this.construct_id + "-cognito-domain", {
      cognitoDomain: { domainPrefix: domainPrefix },
    });
    for (const group of groups) {
      new cognito.CfnUserPoolGroup(this, this.construct_id + "group-" + group, {
        userPoolId: this.pool.userPoolId,
        groupName: group,
      });
    }
  }

    public static async validateUserPool(pool:any, region: string): Promise<any> {
        try {
            if (pool.exists) {
               console.log("Validate user pool"+ pool.poolName);
              let client = new CognitoIdentityProviderClient({
                region: region,
              });
              const userPoolDetails = await client.send(
                new DescribeUserPoolCommand({ UserPoolId: pool.userPoolId })
              );
              let isValid = true;
              // check the pool name
              if (pool.poolName !== userPoolDetails.UserPool?.Name) {
                return Promise.reject("Pool Name not match " + pool.userPoolId);
              }

              // Lamda config
            //   if (
            //     pool.poolLambdaTriggerArn !==
            //     userPoolDetails.UserPool?.LambdaConfig?.CustomMessage
            //   ) {
            //     return Promise.reject("Lamda config not match " + pool.poolName);
            //   }

              // Validate Domain
              if (
                pool.cognitoDomainPrefix !==
                userPoolDetails.UserPool?.Domain
              ) {
                return Promise.reject("Domain not match " + pool.poolName);
              }

              //validate UsernameAttributes
              if (
                !compareArray(pool.UsernameAttributes, userPoolDetails.UserPool?.UsernameAttributes)
              ) {
                return Promise.reject("User Attribute not match " + pool.poolName);
              }
              

              // validate Password Policy
              if (
                !this.compareObjects(pool.Policies.PasswordPolicy,userPoolDetails.UserPool?.Policies?.PasswordPolicy)
              ) {
                return Promise.reject("Policy not match " + pool.poolName);
              }

             const  SchemaAttributes = [
                "sub",
                "name",
                "given_name",
                "family_name",
                "middle_name",
                "nickname",
                "preferred_username",
                "profile",
                "picture",
                "website",
                "email",
                "email_verified",
                "gender",
                "birthdate",
                "zoneinfo",
                "locale",
                "phone_number",
                "phone_number_verified",
                "address",
                "updated_at",
                "custom:mfa_backup_code",
                "custom:accepted_documents",
                "custom:user_preferences",
              ]
              // validate SchemaAttributes
              const scheaAttributes = userPoolDetails.UserPool?.SchemaAttributes?.map(item=> item.Name)
              if (
                !compareArray(SchemaAttributes, scheaAttributes)
              ) {
                return Promise.reject("User SchemaAttributes not match " + pool.poolName);
              }

              // validate group
              const groupList = await client.send(
                new ListGroupsCommand({ UserPoolId: pool.userPoolId })
              );
              const cognitoGroupList: any = groupList
                ? groupList.Groups?.map((item) => item.GroupName)
                : [];
              if (!compareArray(pool.groups,cognitoGroupList)) {
                return Promise.reject(
                  "Group not match " + pool.poolName
                );
              }
              
              return Promise.resolve(isValid);
            }
            return Promise.resolve(true)
        } catch (err) {
            console.log("Error", err);
            return Promise.reject(err)
        }
    }


    public static compareObjects(o1: any, o2: any):boolean{
        for(var p in o1){
            if(o1.hasOwnProperty(p)){
                if(o1[p] !== o2[p]){
                    return false;
                }
            }
        }
        for(var p in o2){
            if(o2.hasOwnProperty(p)){
                if(o1[p] !== o2[p]){
                    return false;
                }
            }
        }
        return true;
    };
}
