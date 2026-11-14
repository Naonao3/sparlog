import { Duration, RemovalPolicy } from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as rds from 'aws-cdk-lib/aws-rds'
import { Construct } from 'constructs'
import { type EnvironmentConfig } from '../config'

export interface DatabaseProps {
  config: EnvironmentConfig
  vpc: ec2.IVpc
}

/**
 * RDS for PostgreSQL。接続情報（ユーザー名・パスワード・ホスト）は Secrets Manager に自動生成される。
 * アクセスを許可するのは securityGroup に対して（ECS タスクからの許可は ECS 側で追加する）。
 */
export class Database extends Construct {
  readonly instance: rds.DatabaseInstance
  readonly securityGroup: ec2.SecurityGroup

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id)
    const { config, vpc } = props

    this.securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc,
      description: 'SparLog RDS',
      allowAllOutbound: false,
    })

    this.instance = new rds.DatabaseInstance(this, 'Instance', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: new ec2.InstanceType(config.database.instanceType),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.securityGroup],
      publiclyAccessible: false,
      credentials: rds.Credentials.fromGeneratedSecret('sparlog_admin', {
        secretName: `sparlog/${config.envName}/database`,
      }),
      databaseName: 'sparlog',
      allocatedStorage: config.database.allocatedStorageGiB,
      maxAllocatedStorage: config.database.allocatedStorageGiB * 5,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      multiAz: false,
      backupRetention: Duration.days(config.database.backupRetentionDays),
      deletionProtection: config.isProduction,
      removalPolicy: config.isProduction ? RemovalPolicy.SNAPSHOT : RemovalPolicy.DESTROY,
      autoMinorVersionUpgrade: true,
      enablePerformanceInsights: false,
      cloudwatchLogsExports: ['postgresql'],
    })
  }
}
