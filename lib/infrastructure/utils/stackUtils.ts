import {Fn} from "aws-cdk-lib"


import { CloudFormationClient, ListExportsCommand, ListExportsCommandOutput } from "@aws-sdk/client-cloudformation" // ES Modules import
// const { CloudFormationClient, ListExportsCommand } = require("@aws-sdk/client-cloudformation"); // CommonJS import
const cloufformationClient = new CloudFormationClient({ region: process.env.CDK_DEFAULT_REGION,retryMode: "adaptive" });
const exportedVariables:{[key:string]:string} = {};

export function resolveExportedVar(envValue:string):string{
    if(envValue.includes(":exp:")){
        const subValue=envValue.substring(
            envValue.indexOf(":exp:") + ":exp:".length,

            envValue.indexOf(":pxe:")
        );

        const convertedValue=Fn.importValue(subValue)
        return resolveExportedVar(envValue.replaceAll(":exp:"+subValue+":pxe:",convertedValue))
    }
    return envValue
}
export function addExportedTagsToVar(tags:any,varName:string){
    return ":exp:"+tags["global"]["cicdStage"]+varName+":pxe:"
}
export async function retrieveExportedVar(envValue:string,nextToken:undefined|string=undefined):Promise<string>{
    if(exportedVariables[envValue]){
        return exportedVariables[envValue]
    }
    else{
        const command = new ListExportsCommand({NextToken:nextToken});

        const exportedTemp:ListExportsCommandOutput= await cloufformationClient.send(command);
        if(exportedTemp.Exports) {
            for (const expVar of exportedTemp.Exports) {
                if(expVar.Name && expVar.Value)
                    exportedVariables[expVar.Name]= expVar.Value
            }
        }
        console.log(JSON.stringify(exportedTemp))
        if(exportedTemp.NextToken) return await retrieveExportedVar(envValue,exportedTemp.NextToken)
        else return exportedVariables[envValue]
    }
}
