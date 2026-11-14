import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib'
import { type Construct } from 'constructs'
import { type EnvironmentConfig } from './config'
import { Auth } from './constructs/auth'
import { Database } from './constructs/database'
import { Network } from './constructs/network'
import { Storage } from './constructs/storage'

export interface SparlogStackProps extends StackProps {
  config: EnvironmentConfig
  cloudFrontPublicKeyPem: string
}

/**
 * SparLog の AWS リソース一式（環境ごとに1スタック）。
 * API（ECS Fargate + ALB）は後続の PR でこのスタックに追加する。
 */
export class SparlogStack extends Stack {
  readonly network: Network
  readonly database: Database
  readonly storage: Storage
  readonly auth: Auth

  constructor(scope: Construct, id: string, props: SparlogStackProps) {
    super(scope, id, props)
    const { config } = props

    this.network = new Network(this, 'Network')
    this.database = new Database(this, 'Database', { config, vpc: this.network.vpc })
    this.storage = new Storage(this, 'Storage', {
      config,
      cloudFrontPublicKeyPem: props.cloudFrontPublicKeyPem,
    })
    this.auth = new Auth(this, 'Auth', { config })

    // ---- バックエンド / フロントエンドの環境変数に設定する値 ----
    new CfnOutput(this, 'CognitoUserPoolId', { value: this.auth.userPool.userPoolId })
    new CfnOutput(this, 'CognitoUserPoolClientId', {
      value: this.auth.userPoolClient.userPoolClientId,
    })
    new CfnOutput(this, 'CognitoIssuer', { value: this.auth.issuer })
    new CfnOutput(this, 'CognitoDomain', { value: this.auth.domain.baseUrl() })
    new CfnOutput(this, 'GoogleRedirectUri', {
      value: this.auth.googleRedirectUri,
      description: 'Google Cloud Console の承認済みリダイレクト URI に登録する',
    })
    new CfnOutput(this, 'VideoBucketName', { value: this.storage.bucket.bucketName })
    new CfnOutput(this, 'MediaDistributionDomain', {
      value: this.storage.distribution.distributionDomainName,
    })
    new CfnOutput(this, 'CloudFrontKeyPairId', { value: this.storage.publicKey.publicKeyId })
    new CfnOutput(this, 'DatabaseEndpoint', {
      value: this.database.instance.dbInstanceEndpointAddress,
    })
    new CfnOutput(this, 'DatabaseSecretArn', {
      value: this.database.instance.secret?.secretArn ?? '',
    })
  }
}
