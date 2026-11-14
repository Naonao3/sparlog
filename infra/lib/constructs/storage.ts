import { Duration, RemovalPolicy } from 'aws-cdk-lib'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as s3 from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'
import { type EnvironmentConfig } from '../config'

export interface StorageProps {
  config: EnvironmentConfig
  /** CloudFront 署名付きURLの検証に使う公開鍵（PEM）。秘密鍵はバックエンドだけが持つ */
  cloudFrontPublicKeyPem: string
}

/**
 * 動画・サムネイルの保存先。
 * - アップロード: バックエンドが発行する S3 の Presigned URL（PUT）でブラウザから直接送る
 * - 再生・サムネイル: CloudFront の署名付きURL経由で配信する（バケットは非公開のまま）
 */
export class Storage extends Construct {
  readonly bucket: s3.Bucket
  readonly distribution: cloudfront.Distribution
  readonly publicKey: cloudfront.PublicKey

  constructor(scope: Construct, id: string, props: StorageProps) {
    super(scope, id)
    const { config } = props

    this.bucket = new s3.Bucket(this, 'VideoBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.HEAD],
          allowedOrigins: config.frontendOrigins,
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [{ abortIncompleteMultipartUploadAfter: Duration.days(1) }],
      removalPolicy: config.isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !config.isProduction,
    })

    this.publicKey = new cloudfront.PublicKey(this, 'SigningPublicKey', {
      encodedKey: props.cloudFrontPublicKeyPem,
      comment: `SparLog ${config.envName} playback URL signing`,
    })
    const keyGroup = new cloudfront.KeyGroup(this, 'SigningKeyGroup', {
      items: [this.publicKey],
    })

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `SparLog ${config.envName} media`,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        // 署名のない URL は 403（バケットの中身を直接見せない）
        trustedKeyGroups: [keyGroup],
      },
      // 日本を含む価格クラス
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    })
  }
}
