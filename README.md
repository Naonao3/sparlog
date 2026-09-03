# SparLog

スパーリング・練習動画を管理・振り返るための Web アプリケーション。

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 14 (App Router) / TypeScript / TailwindCSS / shadcn/ui |
| データフェッチ | TanStack Query v5 / Zustand |
| バックエンド | Node.js / TypeScript / Hono |
| DB | PostgreSQL (Supabase) + Prisma |
| 認証 | Supabase Auth（Google OAuth・メール＋パスワード） |
| ストレージ | Cloudflare R2（Presigned URL 直接アップロード） |
| 動画処理 | fluent-ffmpeg（サムネイル生成・メタデータ抽出） |

```
sparlog/
├── backend/     # Hono API サーバー
├── frontend/    # Next.js アプリ
├── docs/        # 実装方針資料
└── CLAUDE.md    # 実装ルール
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

---

## 動画アップロードの流れ

Hono サーバーは動画バイナリを中継しない（メモリ・帯域コスト削減のため）。

```
1. POST /api/v1/videos          メタデータ登録 → R2 の Presigned URL（PUT・15分）を返す
2. PUT  <presigned url>         フロントエンドから R2 へ直接アップロード
3. POST /api/v1/videos/:id/complete  完了通知（status: PROCESSING で即時レスポンス）
4. サーバー側で R2 → ffmpeg でサムネイル生成・メタデータ抽出
5. status: READY（フロントエンドは GET /videos/:id をポーリングして待つ）
```

`UPLOADING → PROCESSING → READY`、失敗時は `ERROR`（`/complete` の再送でリトライ可能）。

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

## デプロイ

- **フロントエンド**: Vercel（Root Directory に `frontend` を指定）
- **バックエンド**: Render / Railway（`backend/Dockerfile` を利用。リリースコマンドに `npx prisma migrate deploy`）
- 環境変数はそれぞれのダッシュボードで設定する。`.env` はコミットしない。
