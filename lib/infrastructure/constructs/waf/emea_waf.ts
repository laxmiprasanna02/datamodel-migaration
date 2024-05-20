import {Construct} from "constructs";
import {CfnRuleGroup, CfnWebACL} from "aws-cdk-lib/aws-wafv2";
import {CfnOutput} from "aws-cdk-lib";

export class EmeaWAF extends Construct {
    construct_id: string
    scope: string //Regional is for ALBs or API GWs, if not "CLOUDFRONT"
    visibilityConfig: (metricName: string) => CfnWebACL.VisibilityConfigProperty

    constructor(scope: Construct, stack_id: string, tags: any, enableCloudWatch = false) {
        const construct_id = 'emea-waf'
        super(scope, construct_id)
        this.construct_id = construct_id
        this.scope = "REGIONAL"
        this.visibilityConfig = (metricName: string) => {
            return {
                cloudWatchMetricsEnabled: enableCloudWatch,
                metricName: metricName,
                sampledRequestsEnabled: enableCloudWatch
            }
        }

        const HTTP_READ_METHODS = ["GET"]
        const HTTP_WRITE_METHODS = ["POST", "PUT", "DELETE", "PATCH"]

        const defaultRules = [
            this.createDefaultRule("READ", tags["WAF_SECURITY_LIMITS"]["max_reqs_allowed"]*2, HTTP_READ_METHODS),
            this.createDefaultRule("WRITE", tags["WAF_SECURITY_LIMITS"]["max_reqs_allowed"], HTTP_WRITE_METHODS)
        ]
        const defaultGroup = new CfnRuleGroup(scope, "ACL-RuleGroup-default", {
            name: "default-http-methods",
            description: "This Group sets the default maximum limit for all HTTP methods",
            capacity: defaultRules.length * 6, //6 is the WCU for this current rule specs
            scope: this.scope,
            visibilityConfig: this.visibilityConfig("WAF-RuleGroup-default-read"),
            rules: defaultRules
        })

        const acl = new CfnWebACL(scope, "ACL-APIs", {
            name: "APIs",
            description: "ACL for the Fluidra Emea Platform to define API request limitations based on IP addresses.",

            defaultAction: {
                allow: {}
            },
            scope: this.scope,
            visibilityConfig: this.visibilityConfig("WAF-ACL-APIs"),

            rules: [{
                name: "default-http-methods",
                priority: 9999, //priority inside ACL
                statement: { ruleGroupReferenceStatement: { arn: defaultGroup.attrArn } },
                visibilityConfig: this.visibilityConfig("WAF-ACL-APIs-rules"),
                overrideAction: {none: {}}
            }]
        })
        const name = tags['stage'] + 'PlatformDataModelSecLimitsWafArn'

        new CfnOutput(this, name, {value:acl.attrArn,exportName:name})
    }

    private createDefaultRule(op: "READ"|"WRITE", limit: number, httpMethods: string[]): CfnWebACL.RuleProperty {
        return {
            name: "default-rule-" + op + "s",
            priority: Number(op === "WRITE"), //priority inside the rule group
            statement: {
                rateBasedStatement: {
                    aggregateKeyType: "IP", //or "FORWARDED_IP" if it comes from an HTTP header
                    limit: limit, //this is within 5 mins!
                    scopeDownStatement: {
                        andStatement: {
                            statements: [
                                {
                                    regexMatchStatement: {
                                        fieldToMatch: {
                                            method: { }
                                        },
                                        regexString: httpMethods.reduce((rx:string, method:string, i:number) => {
                                            rx = rx + method;
                                            if (i < httpMethods.length-1) rx = rx + '|'
                                            return rx
                                        }, '^') + "$",
                                        textTransformations: [{priority: 0, type: "NONE"}]
                                    }
                                },
                                { //This second statement is just to allow to have the parent AND, to allow APIs set their own triggers.
                                    sizeConstraintStatement: {
                                        fieldToMatch: {
                                            uriPath: { }
                                        },
                                        comparisonOperator: "NE",
                                        size: 0,
                                        textTransformations: [{priority: 0, type: "NONE"}]
                                    }
                                }
                            ]
                        },
                    }
                }
            },
            action: {
                block: {
                    customResponse: {
                        responseCode: 429,
                        responseHeaders: [{
                            name: "Access-Control-Allow-Origin",
                            value: "*"
                        }]
                    }
                }
            },
            visibilityConfig: this.visibilityConfig("WAF-Rule-default-" + op + "s")
        }
    }
}