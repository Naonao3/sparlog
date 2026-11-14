import { Duration, RemovalPolicy, SecretValue, Stack } from 'aws-cdk-lib'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import { Construct } from 'constructs'
import { type EnvironmentConfig } from '../config'

export interface AuthProps {
  config: EnvironmentConfig
}

/**
 * Cognito ユーザープール。
 * - メールアドレス＋パスワードでのサインアップ（確認コードをメール送信）
 * - Google ログイン（config.googleClientId を設定した場合のみ）
 * - フロントエンドは自前UI（Amplify Auth）から SRP で認証し、Google は OAuth（認可コード＋PKCE）で連携する
 *
 * ユーザープールの username は Cognito が採番する UUID（= sub）になり、
 * バックエンドはこの sub を users.id として使う。
 */
export class Auth extends Construct {
  readonly userPool: cognito.UserPool
  readonly userPoolClient: cognito.UserPoolClient
  readonly domain: cognito.UserPoolDomain

  constructor(scope: Construct, id: string, props: AuthProps) {
    super(scope, id)
    const { config } = props

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `sparlog-${config.envName}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      signInCaseSensitive: false,
      autoVerify: { email: true },
      keepOriginal: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: false,
        requireUppercase: false,
        requireDigits: false,
        requireSymbols: false,
        tempPasswordValidity: Duration.days(3),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      featurePlan: cognito.FeaturePlan.ESSENTIALS,
      // Cognito 既定のメール送信（1日50通まで）。本番で足りなくなったら SES に切り替える
      email: cognito.UserPoolEmail.withCognito(),
      deletionProtection: config.isProduction,
      removalPolicy: config.isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    })

    // OAuth（Google ログイン）のリダイレクトに使うドメイン
    this.domain = this.userPool.addDomain('Domain', {
      cognitoDomain: { domainPrefix: config.cognitoDomainPrefix },
    })

    const identityProviders: cognito.UserPoolClientIdentityProvider[] = [
      cognito.UserPoolClientIdentityProvider.COGNITO,
    ]
    let googleProvider: cognito.UserPoolIdentityProviderGoogle | undefined

    if (config.googleClientId !== undefined) {
      googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'Google', {
        userPool: this.userPool,
        clientId: config.googleClientId,
        clientSecretValue: SecretValue.secretsManager(
          `sparlog/${config.envName}/google-oauth-client-secret`,
        ),
        scopes: ['openid', 'email', 'profile'],
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
          emailVerified: cognito.ProviderAttribute.GOOGLE_EMAIL_VERIFIED,
          fullname: cognito.ProviderAttribute.GOOGLE_NAME,
          profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
        },
      })
      identityProviders.push(cognito.UserPoolClientIdentityProvider.GOOGLE)
    }

    this.userPoolClient = this.userPool.addClient('WebClient', {
      userPoolClientName: `sparlog-${config.envName}-web`,
      // ブラウザで動く公開クライアントなのでシークレットは持たない
      generateSecret: false,
      authFlows: { userSrp: true },
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: config.frontendOrigins.map((origin) => `${origin}/auth/callback`),
        logoutUrls: config.frontendOrigins.map((origin) => `${origin}/login`),
      },
      supportedIdentityProviders: identityProviders,
    })

    if (googleProvider !== undefined) {
      this.userPoolClient.node.addDependency(googleProvider)
    }
  }

  /** Google Cloud Console の「承認済みのリダイレクト URI」に登録する URL */
  get googleRedirectUri(): string {
    return `${this.domain.baseUrl()}/oauth2/idpresponse`
  }

  /** JWT の iss（バックエンドの検証に使う） */
  get issuer(): string {
    return `https://cognito-idp.${Stack.of(this).region}.amazonaws.com/${this.userPool.userPoolId}`
  }
}
