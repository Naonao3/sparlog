import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { App, Tags } from 'aws-cdk-lib'
import { loadEnvironmentConfig, parseEnvironmentName } from '../lib/config'
import { SparlogStack } from '../lib/sparlog-stack'

const app = new App()

const envName = parseEnvironmentName(app.node.tryGetContext('env'))
const config = loadEnvironmentConfig(envName, app.node.tryGetContext('sparlog'))

const publicKeyPath = join(__dirname, '..', 'keys', `${envName}-cloudfront-public.pem`)
if (!existsSync(publicKeyPath)) {
  throw new Error(
    `CloudFront 署名用の公開鍵がありません: ${publicKeyPath}\n` +
      `  npm run keys:cloudfront -- ${envName} で鍵ペアを生成してください`,
  )
}

const stack = new SparlogStack(app, `Sparlog-${envName}`, {
  config,
  cloudFrontPublicKeyPem: readFileSync(publicKeyPath, 'utf8'),
  env: { account: config.account ?? process.env.CDK_DEFAULT_ACCOUNT, region: config.region },
  terminationProtection: config.isProduction,
  description: `SparLog (${envName})`,
})

Tags.of(stack).add('Project', 'sparlog')
Tags.of(stack).add('Environment', envName)
