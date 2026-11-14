import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { describe, it } from 'node:test'
import { App } from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'
import { type EnvironmentConfig, loadEnvironmentConfig } from '../lib/config'
import { SparlogStack } from '../lib/sparlog-stack'

const { publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

function baseConfig(overrides: Partial<EnvironmentConfig> = {}): EnvironmentConfig {
  return {
    envName: 'dev',
    isProduction: false,
    region: 'ap-northeast-1',
    frontendOrigins: ['http://localhost:3000'],
    cognitoDomainPrefix: 'sparlog-test',
    database: { instanceType: 't4g.micro', allocatedStorageGiB: 20, backupRetentionDays: 1 },
    ...overrides,
  }
}

function synth(config: EnvironmentConfig): Template {
  const app = new App()
  const stack = new SparlogStack(app, 'Test', {
    config,
    cloudFrontPublicKeyPem: publicKey,
    env: { account: '123456789012', region: config.region },
  })
  return Template.fromStack(stack)
}

describe('SparlogStack', () => {
  it('NAT Gateway を作らない', () => {
    synth(baseConfig()).resourceCountIs('AWS::EC2::NatGateway', 0)
  })

  it('RDS は非公開・暗号化・isolated サブネットに置く', () => {
    const template = synth(baseConfig())
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      Engine: 'postgres',
      PubliclyAccessible: false,
      StorageEncrypted: true,
      DBName: 'sparlog',
    })
  })

  it('S3 バケットは公開アクセスを全てブロックし、フロントからの PUT のみ CORS 許可する', () => {
    synth(baseConfig()).hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      CorsConfiguration: {
        CorsRules: [
          Match.objectLike({
            AllowedMethods: ['PUT', 'HEAD'],
            AllowedOrigins: ['http://localhost:3000'],
          }),
        ],
      },
    })
  })

  it('CloudFront は署名付きURLのみ受け付ける', () => {
    synth(baseConfig()).hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({
          TrustedKeyGroups: Match.anyValue(),
          ViewerProtocolPolicy: 'redirect-to-https',
        }),
      }),
    })
  })

  it('Cognito クライアントはシークレットなし・SRP・コールバックURLをフロントのオリジンから生成する', () => {
    synth(baseConfig()).hasResourceProperties('AWS::Cognito::UserPoolClient', {
      GenerateSecret: false,
      ExplicitAuthFlows: Match.arrayWith(['ALLOW_USER_SRP_AUTH']),
      CallbackURLs: ['http://localhost:3000/auth/callback'],
      LogoutURLs: ['http://localhost:3000/login'],
      SupportedIdentityProviders: ['COGNITO'],
    })
  })

  it('googleClientId を設定すると Google IdP を有効にする', () => {
    const template = synth(baseConfig({ googleClientId: 'google-client-id' }))
    template.hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
      ProviderName: 'Google',
      ProviderType: 'Google',
    })
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      SupportedIdentityProviders: Match.arrayWith(['COGNITO', 'Google']),
    })
  })

  it('本番はデータを消さない設定になる', () => {
    const template = synth(baseConfig({ envName: 'prod', isProduction: true }))
    template.hasResource('AWS::RDS::DBInstance', {
      DeletionPolicy: 'Snapshot',
      Properties: Match.objectLike({ DeletionProtection: true }),
    })
    template.hasResource('AWS::S3::Bucket', { DeletionPolicy: 'Retain' })
    template.hasResource('AWS::Cognito::UserPool', { DeletionPolicy: 'Retain' })
  })
})

describe('loadEnvironmentConfig', () => {
  it('frontendOrigins が空ならエラーにする', () => {
    assert.throws(
      () =>
        loadEnvironmentConfig('prod', {
          prod: {
            region: 'ap-northeast-1',
            frontendOrigins: [],
            cognitoDomainPrefix: 'sparlog',
            database: { instanceType: 't4g.micro', allocatedStorageGiB: 20, backupRetentionDays: 7 },
          },
        }),
      /frontendOrigins/,
    )
  })
})
