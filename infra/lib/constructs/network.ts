import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs'

/**
 * VPC。コスト削減のため NAT Gateway は作らない。
 * - public: ECS タスク（パブリックIP付き・セキュリティグループで ALB からのみ許可）
 * - isolated: RDS（インターネットに出られない）
 */
export class Network extends Construct {
  readonly vpc: ec2.Vpc

  constructor(scope: Construct, id: string) {
    super(scope, id)

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
      gatewayEndpoints: {
        // S3 への通信を VPC 内で完結させる（Gateway 型は無料）
        S3: { service: ec2.GatewayVpcEndpointAwsService.S3 },
      },
    })
  }
}
