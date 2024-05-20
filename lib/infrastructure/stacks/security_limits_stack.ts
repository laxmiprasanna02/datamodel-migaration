import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EmeaWAF } from "../constructs/waf/emea_waf";

export class SecurityLimitsStack extends Stack {
  constructor(scope: Construct, stack_id: string, tags: any, props?: StackProps) {
    super(scope, stack_id, props);

    // API GW (WAF) limits
    new EmeaWAF(this, stack_id, tags)

    // IoT Device Defender limits

  }
}
