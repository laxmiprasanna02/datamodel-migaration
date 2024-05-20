#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {AssetsStack} from '../lib/infrastructure/stacks/assets_stack';
import {PlatformQuicksightStack} from '../lib/infrastructure/stacks/platform-quicksight-stack';
import {SecurityLimitsStack} from "../lib/infrastructure/stacks/security_limits_stack";
import {AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId} from "@aws-cdk/custom-resources";
import {retrieveExportedVar} from "../lib/infrastructure/utils/stackUtils";

// Get which stage is this cdk deploying and retrieve its environment variables/tags
var stage = (process.env.AWS_DEPLOY_STAGE_ENVIRONMENT != undefined) ? process.env.AWS_DEPLOY_STAGE_ENVIRONMENT.toLowerCase() : 'dev'
function replaceVariables(inObj: { [key: string]: any }, variable: string, value: string): any {
    const resultObj = inObj
    Object.keys(resultObj).map((item) => {
        if (typeof resultObj[item] === "string") {
            resultObj[item] = resultObj[item].replaceAll("{" + variable + "}", value)
        } else {
            resultObj[item] = replaceVariables(resultObj[item], variable, value)
        }
    })
    return resultObj
}
import('../stages/' + stage + '.json').then(async function (module) {
    var tags = module.default
    tags["stage"] = stage
    for (const globalVar of Object.keys(tags["global"])) {
        tags = replaceVariables(tags, globalVar, tags["global"][globalVar])
    }
    var env = {account: tags["pipeline_account"], region: tags["pipeline_region"]}

    const app = new cdk.App();
    var stacks: Array<cdk.Stack> = []

    for (const expVar of tags["preloadExternalVariables"]) {
        tags[expVar.name] = await retrieveExportedVar(expVar.ref)
    }


    await AssetsStack.checkExistingResources(tags,app)
    const assets=new AssetsStack(
        app,
        tags["project_name"] + '-' + tags["stage"] + "-assets",
        tags,
        {
            env: env,
        }
    )
    await assets.assignOutputs(tags)
    stacks.push(assets);

    stacks.push(new PlatformQuicksightStack(
        app,
        tags["project_name"] + '-' + tags["stage"] + "-quicksight",
        tags,
        {
            env: env,
        }
    ));

    stacks.push(new SecurityLimitsStack(
        app,
        tags["project_name"] + '-' + tags["stage"] + "-sec-limits",
        tags,
        {
            env: env,
        }
    ));

    /*
    stacks.push(new IoTStack(
      app,
      tags["project_name"]+'-'+tags["stage"]+"-iot",
      tags,
      {
        env: env,
      }
    ));
    */

    //Add informational tags to CDK App to simplify management, cost-allocation, access control, etc.
    for (var stack of stacks)
        cdk.Tags.of(stack).add("Stage", stage)

    for (var stack of stacks)
        for (var env_tag in tags["tags"])
            cdk.Tags.of(stack).add(env_tag, tags["tags"][env_tag])


    app.synth()
})
