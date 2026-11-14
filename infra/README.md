# SparLog infra (AWS CDK)

SparLog の AWS リソースを CDK（TypeScript）で管理する。環境ごとに 1 スタック（`Sparlog-dev` / `Sparlog-prod`）。

| リソース | 内容 |
|---|---|
| VPC | 2AZ・public / isolated サブネット。NAT Gateway なし、S3 Gateway エンドポイントあり |
| RDS | PostgreSQL 16（isolated サブネット・非公開）。接続情報は Secrets Manager `sparlog/<env>/database` |
| S3 | 動画・サムネイル（非公開）。フロントからの Presigned PUT のみ CORS 許可 |
| CloudFront | S3 を OAC 経由で配信。署名付きURLのみ受け付ける |
| Cognito | ユーザープール（メール＋パスワード、Google は任意）、Web クライアント、OAuth 用ドメイン |

> API（ECS Fargate + ALB）と CI/CD は後続の PR で追加する。

## 初回セットアップ

```bash
cd infra
npm install

# 1. CloudFront 署名用の鍵ペアを作る（公開鍵はコミット、秘密鍵は Secrets Manager へ）
npm run keys:cloudfront -- dev
aws secretsmanager create-secret --region ap-northeast-1 \
  --name sparlog/dev/cloudfront-private-key \
  --secret-string file://keys/dev-cloudfront-private.pem

# 2. アカウント・リージョンごとに一度だけ
npx cdk bootstrap -c env=dev

# 3. デプロイ
npx cdk diff -c env=dev
npx cdk deploy -c env=dev
```

デプロイ後に表示される Outputs（User Pool ID・Client ID・バケット名など）をバックエンド / フロントエンドの環境変数に設定する。

## Google ログインを有効にする

1. Google Cloud Console で OAuth クライアント（ウェブアプリケーション）を作成する
   - 承認済みのリダイレクト URI: Outputs の `GoogleRedirectUri`
     （`https://<cognitoDomainPrefix>.auth.ap-northeast-1.amazoncognito.com/oauth2/idpresponse`）
2. クライアントシークレットを Secrets Manager に登録する
   ```bash
   aws secretsmanager create-secret --region ap-northeast-1 \
     --name sparlog/dev/google-oauth-client-secret \
     --secret-string '<client secret>'
   ```
3. `cdk.json` の `context.sparlog.dev.googleClientId` にクライアントIDを設定して再デプロイする

## 設定（cdk.json の `context.sparlog.<env>`）

| キー | 説明 |
|---|---|
| `account` | 任意。未指定なら CLI プロファイルのアカウント |
| `region` | デプロイ先リージョン |
| `frontendOrigins` | フロントのオリジン（S3 CORS と Cognito コールバック URL に使う）。prod は本番 URL を設定するまで synth できない |
| `cognitoDomainPrefix` | Cognito ドメインのプレフィックス。リージョン内で一意でないとデプロイに失敗するので、使われていたら変更する |
| `googleClientId` | 任意。設定すると Google ログインを有効にする |
| `database.*` | インスタンスタイプ・ストレージ・バックアップ保持日数 |

secret はここに書かない（Secrets Manager で管理する）。

## 削除時の挙動

- dev: `cdk destroy` で RDS・S3（中身ごと）・Cognito も削除される
- prod: RDS はスナップショットを残し、S3・Cognito は保持（削除保護あり）

## コマンド

```bash
npm run typecheck
npm run lint
npm test                      # スタックのアサーションテスト
npx cdk synth -c env=dev
```
