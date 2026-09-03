# SparLog

[![CI](https://github.com/Naonao3/sparlog/actions/workflows/ci.yml/badge.svg)](https://github.com/Naonao3/sparlog/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-4-E36002?logo=hono&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)

スパーリング・練習動画をアップロードして、**シーン単位でコメントを残しながら振り返る**ための Web アプリケーションです。

「あの試合の3ラウンド目、1分23秒のあの場面」——を、タグと再生位置つきのコメントで記録して後から探せるようにすることを目的にしています。

---

## 主な機能

| 機能 | 内容 |
|------|------|
| 動画アップロード | ドラッグ&ドロップ＋進捗表示。Cloudflare R2 へ **Presigned URL で直接アップロード**（API サーバーを経由しない） |
| 自動サムネイル生成 | アップロード完了後にサーバー側で ffmpeg を実行し、サムネイルと長さ・解像度を抽出 |
| タグ・カテゴリ管理 | システム共通タグ（練習種別・技術・ポジション・振り返り）＋ユーザー独自タグ |
| 検索・絞り込み | キーワード / タグ（AND 条件）/ 公開設定 / ステータス、カーソルベースのページネーション |
| メモ | 動画単位のテキストメモ |
| タイムスタンプコメント | 再生位置（秒）に紐づくシーン単位のコメント。クリックでその位置から再生 |
| 認証 | Google OAuth・メール＋パスワード・パスワードリセット（Supabase Auth） |

---

## アーキテクチャ

API サーバーは動画バイナリを一切中継しません（メモリ・帯域コストの削減）。
認証も自前では持たず、Supabase Auth が発行した JWT の署名検証のみを行います。

```
   ┌─────────────────────────┐
   │  Browser (Next.js)      │
   │  Vercel                 │
   └───┬───────────┬─────────┘
       │           │
       │           └── ② 動画を直接 PUT ──────────┐
       │                                           ▼
       │  ① API 呼び出し                  ┌──────────────────┐
       │     Bearer <Supabase JWT>        │  Cloudflare R2   │
       ▼                                  │  （非公開バケット）│
   ┌─────────────────────────┐            └────────┬─────────┘
   │  Hono API (Render)      │                     │
   │  ├ JWT 署名検証のみ      │ ③ 完了通知後に取得 ──┘
   │  ├ Presigned URL 発行    │
   │  └ ffmpeg でサムネ生成   │
   └───┬─────────────────────┘
       │ Prisma
       ▼
   ┌─────────────────────────┐      ┌──────────────────┐
   │ PostgreSQL (Supabase)   │◀─────│  Supabase Auth   │
   │ auth.users → public.users を   │  Google / Email  │
   │ トリガーで自動作成             └──────────────────┘
   └─────────────────────────┘
```

### 動画アップロードの流れ

```
1. POST /api/v1/videos               メタデータ登録 → R2 の Presigned URL（PUT・15分）を返す
2. PUT  <presigned url>              フロントエンドから R2 へ直接アップロード
3. POST /api/v1/videos/:id/complete  完了通知（202 を即返し、処理は非同期で開始）
4. サーバーが R2 から取得 → ffmpeg でサムネイル生成・メタデータ抽出
5. status: READY                     フロントエンドは GET /videos/:id をポーリングして待つ
```

ステータス遷移は `UPLOADING → PROCESSING → READY`、失敗時は `ERROR`（`/complete` の再送でリトライ可能）。

---

## 技術スタック

| レイヤー | 技術 | 選定理由 |
|---------|------|---------|
| フロントエンド | Next.js 14 (App Router) / TypeScript | Server / Client Component の使い分け |
| スタイリング | TailwindCSS / shadcn/ui | 高速な UI 構築とデザインの統一 |
| データフェッチ | TanStack Query v5 | キャッシュ・ポーリング・楽観的更新の管理 |
| 状態管理 | Zustand | プレイヤーとコメント UI の仲介のみに使用 |
| フォーム | React Hook Form + zod | フロント・バックで同じスキーマ定義の考え方を共有 |
| 動画プレイヤー | Video.js | 再生速度変更・シークの制御 |
| バックエンド | Hono / TypeScript | 軽量・高速、フロントと言語を統一 |
| ORM | Prisma | 型安全なクエリとマイグレーション管理 |
| DB | PostgreSQL (Supabase) | 無料枠・RLS 対応 |
| 認証 | Supabase Auth | Google OAuth とメール認証を無料で利用 |
| ストレージ | Cloudflare R2 | エグレス無料・S3 互換 |
| 動画処理 | fluent-ffmpeg + ffmpeg-static | システムに ffmpeg がなくても動作 |

---

## 設計上のポイント

- **3 層構造の徹底** — ルート → サービス → リポジトリ。Prisma へのアクセスは `repositories/` に集約し、ルート・サービスから直接呼ばない
- **`any` 型ゼロ** — `unknown` + 型ガードで代替。ESLint の `no-explicit-any` を error に設定
- **起動時の環境変数バリデーション** — zod で検証し、欠落時は即座にプロセスを終了させて実行時の undefined 参照を防ぐ
- **エラーハンドリングの集約** — 各ルートで try/catch を書かず、`app.onError` で `{ error: { code, message } }` に整形
- **JWT の alg 固定** — `alg: 'HS256'` と `aud: 'authenticated'` を明示して alg 混同攻撃を防ぐ
- **RLS の有効化** — public スキーマの全テーブルで RLS を有効化し、anon キー経由の PostgREST 直アクセスを遮断（API サーバーは所有者ロールで接続）
- **非公開バケット** — 動画・サムネイルとも公開 URL を持たず、都度発行する署名付き URL で配信
- **カーソルベースページネーション** — オフセットではなくカーソルで、件数が増えても劣化しない一覧取得

---

## ディレクトリ構成

```
sparlog/
├── backend/                      # Hono API サーバー
│   ├── src/
│   │   ├── index.ts              # エントリポイント・エラーハンドラ
│   │   ├── config/env.ts         # 環境変数の zod バリデーション
│   │   ├── routes/               # ルート定義（薄く保つ）
│   │   ├── middleware/           # JWT 検証・リクエストバリデーション
│   │   ├── services/             # ビジネスロジック・R2・ffmpeg
│   │   ├── repositories/         # Prisma を使った DB アクセス
│   │   └── types/                # zod スキーマ・レスポンス DTO
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/           # 初期スキーマ＋Auth トリガー・RLS の手動 SQL
│   │   └── seed.ts               # システム共通カテゴリ・タグ
│   └── Dockerfile
├── frontend/                     # Next.js アプリ
│   ├── app/
│   │   ├── (auth)/               # 認証不要ルート
│   │   ├── (dashboard)/          # 認証必要ルート
│   │   └── auth/callback/        # Supabase Auth のリダイレクト先
│   ├── components/               # ui / video / comment / tag / layout
│   ├── hooks/                    # TanStack Query のカスタムフック
│   ├── lib/                      # Supabase クライアント・API クライアント
│   ├── stores/                   # Zustand ストア
│   └── types/                    # API レスポンス型
├── docs/                         # 実装方針資料
└── CLAUDE.md                     # 実装ルール
```

---

## セットアップ

### 1. 外部サービスの準備

**Supabase**

1. プロジェクトを作成する
2. Authentication > Providers で Google と Email を有効化する
3. Authentication > URL Configuration に `http://localhost:3000/auth/callback` を追加する
4. Settings > API から `Project URL` / `anon key` / `JWT Secret` を控える
5. Settings > Database から接続文字列（Session mode・ポート 5432）を控える

**Cloudflare R2**

1. バケット `sparlog-videos` を作成する（公開設定は不要。すべて署名付き URL で配信する）
2. R2 API トークンを発行し、Access Key ID / Secret Access Key を控える
3. CORS 設定でフロントエンドのオリジンからの `PUT` を許可する

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://<本番ドメイン>"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

### 2. バックエンド

```bash
cd backend
cp .env.example .env      # 控えた値を記入する
npm install
npx prisma migrate deploy # 全テーブル・トリガー・RLS を適用
npm run seed              # システム共通カテゴリ・タグを投入
npm run dev               # http://localhost:8080
```

### 3. フロントエンド

```bash
cd frontend
cp .env.local.example .env.local  # 控えた値を記入する
npm install
npm run dev                       # http://localhost:3000
```

### 環境変数

| ファイル | 変数 |
|---------|------|
| `backend/.env` | `PORT` `DATABASE_URL` `SUPABASE_JWT_SECRET` `R2_ACCOUNT_ID` `R2_ACCESS_KEY_ID` `R2_SECRET_ACCESS_KEY` `R2_BUCKET_NAME` `R2_PUBLIC_DOMAIN` `CORS_ORIGINS` |
| `frontend/.env.local` | `NEXT_PUBLIC_SUPABASE_URL` `NEXT_PUBLIC_SUPABASE_ANON_KEY` `NEXT_PUBLIC_API_BASE_URL` |

詳細はそれぞれの `.env.example` / `.env.local.example` を参照。**secret はコミットしない。**

---

## API

ベース URL: `/api/v1`、認証: `Authorization: Bearer <Supabase JWT>`

| メソッド | パス | 概要 |
|---------|------|------|
| GET / PATCH / DELETE | `/users/me` | プロフィール取得・更新・アカウント削除 |
| GET / POST | `/videos` | 一覧（フィルタ・カーソルページネーション）・登録 |
| GET / PATCH / DELETE | `/videos/:id` | 詳細・更新・削除（R2 も削除） |
| POST | `/videos/:id/complete` | アップロード完了通知 |
| GET | `/videos/:id/stream` | 署名付き再生 URL |
| PUT | `/videos/:id/tags` | タグ一括更新 |
| GET / POST / PATCH / DELETE | `/videos/:id/comments[/:cid]` | コメント |
| GET / POST / PATCH / DELETE | `/videos/:id/timestamp-comments[/:tid]` | タイムスタンプコメント |
| GET | `/categories` | カテゴリ一覧 |
| GET / POST / PATCH / DELETE | `/tags[/:id]` | タグ（共通＋自分の独自タグ） |

`GET /videos` のクエリ: `tag_ids` `visibility` `status` `q` `sort` `order` `limit` `cursor`

エラーレスポンスは全て `{ "error": { "code": "...", "message": "...", "details"?: ... } }` の形式。

---

## 開発コマンド

```bash
# ルートから両方まとめて
npm run install:all
npm run lint
npm run typecheck
npm run build

# 個別
npm run dev:backend
npm run dev:frontend
```

CI（GitHub Actions）では backend / frontend それぞれで lint・typecheck・build を実行しています。

---

## デプロイ

- **フロントエンド**: Vercel（Root Directory に `frontend` を指定）
- **バックエンド**: Render / Railway（`backend/Dockerfile` を利用。リリースコマンドに `npx prisma migrate deploy`）。`render.yaml` を同梱
- 環境変数はそれぞれのダッシュボードで設定する

---

## 今後の拡張予定（v2）

- チーム・ジム単位での動画共有（`teams` / `team_members` / `video_shares` と `visibility: TEAM` の追加）
- HLS アダプティブストリーミング（ffmpeg で HLS 変換、hls.js で再生）
- 練習統計ダッシュボード（カテゴリ別・月別の練習量の可視化）
- GCP への移行（Cloud Run + Cloud SQL + Terraform）
