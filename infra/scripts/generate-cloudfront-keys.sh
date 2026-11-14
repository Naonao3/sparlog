#!/usr/bin/env bash
# CloudFront 署名付きURL用の RSA 鍵ペアを生成する。
#   使い方: npm run keys:cloudfront -- <dev|prod>
#
# - 公開鍵 keys/<env>-cloudfront-public.pem  … コミットする（CDK が CloudFront に登録する）
# - 秘密鍵 keys/<env>-cloudfront-private.pem … コミット禁止（.gitignore 済み）。
#   Secrets Manager に登録したらローカルからは削除してよい。
set -euo pipefail

env_name="${1:-}"
if [[ "$env_name" != "dev" && "$env_name" != "prod" ]]; then
  echo "使い方: npm run keys:cloudfront -- <dev|prod>" >&2
  exit 1
fi

cd "$(dirname "$0")/.."
mkdir -p keys
private_key="keys/${env_name}-cloudfront-private.pem"
public_key="keys/${env_name}-cloudfront-public.pem"

if [[ -e "$public_key" ]]; then
  echo "既に存在します: ${public_key}（作り直す場合は先に削除してください）" >&2
  exit 1
fi

openssl genrsa -out "$private_key" 2048 2>/dev/null
chmod 600 "$private_key"
openssl rsa -pubout -in "$private_key" -out "$public_key" 2>/dev/null

cat <<EOF
生成しました:
  公開鍵: ${public_key}（コミットしてください）
  秘密鍵: ${private_key}（コミット禁止）

秘密鍵を Secrets Manager に登録してください:
  aws secretsmanager create-secret \\
    --region ap-northeast-1 \\
    --name sparlog/${env_name}/cloudfront-private-key \\
    --secret-string file://${private_key}
EOF
