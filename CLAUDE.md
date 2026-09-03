# SparLog — CLAUDE.md

このファイルはClaude Codeが自動的に読み込む指示ファイルです。
実装を始める前に必ず通読してください。

---

## プロジェクト概要

スパーリング・練習動画を管理するWebアプリケーション。

| 項目 | 内容 |
|------|------|
| フロントエンド | Next.js 14 (App Router) + TypeScript |
| バックエンド | Node.js + TypeScript + Hono |
| 認証 | Supabase Auth（Google OAuth・メール＋パスワード） |
| DB | PostgreSQL（Supabase）+ Prisma ORM |
| 動画ストレージ | Cloudflare R2（S3互換） |
| 動画処理 | fluent-ffmpeg（サムネイル生成・メタデータ抽出） |
| フロントエンドホスティング | Vercel |
| バックエンドホスティング | Render または Railway |

---

## リポジトリ構成

monorepo構成で管理する。

```
sparlog/
├── frontend/    # Next.js アプリ
├── backend/     # Hono API サーバー
├── CLAUDE.md    # このファイル
└── docs/
    └── sparlog_implementation_guide.docx
```

---

## ディレクトリ構成

### フロントエンド

```
frontend/
├── app/
│   ├── (auth)/                   # 認証不要ルート
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── reset-password/page.tsx
│   ├── (dashboard)/              # 認証必要ルート
│   │   ├── layout.tsx            # 認証チェック・サイドバー
│   │   ├── videos/
│   │   │   ├── page.tsx          # 動画一覧
│   │   │   ├── upload/page.tsx   # アップロード
│   │   │   └── [id]/page.tsx     # 動画詳細・再生
│   │   ├── tags/page.tsx         # タグ管理
│   │   └── settings/page.tsx     # プロフィール設定
│   └── api/                      # Route Handlers（必要に応じて）
├── components/
│   ├── ui/                       # shadcn/ui コンポーネント
│   ├── video/                    # VideoPlayer, VideoCard, UploadForm...
│   ├── comment/                  # CommentList, TimestampComment...
│   └── layout/                   # Sidebar, Header...
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # ブラウザ用クライアント
│   │   └── server.ts             # サーバーコンポーネント用クライアント
│   ├── api/                      # Hono APIクライアント関数
│   └── utils/
├── hooks/                        # useVideos, useComments...
├── stores/                       # Zustand ストア
└── types/                        # 型定義（APIレスポンス型など）
```

### バックエンド

```
backend/
├── src/
│   ├── index.ts                  # エントリポイント・Honoアプリ定義
│   ├── routes/                   # ルート定義
│   │   ├── videos.ts
│   │   ├── comments.ts
│   │   ├── timestampComments.ts
│   │   ├── tags.ts
│   │   ├── categories.ts
│   │   └── users.ts
│   ├── middleware/
│   │   └── auth.ts               # Supabase JWT検証
│   ├── services/                 # ビジネスロジック
│   │   ├── video.ts
│   │   ├── storage.ts            # R2操作（@aws-sdk/client-s3）
│   │   └── ffmpeg.ts             # fluent-ffmpeg処理
│   ├── repositories/             # Prismaを使ったDB操作
│   │   ├── video.ts
│   │   ├── comment.ts
│   │   ├── tag.ts
│   │   └── user.ts
│   └── types/                    # 型定義・zodスキーマ
│       └── index.ts
├── prisma/
│   ├── schema.prisma             # Prismaスキーマ定義
│   └── migrations/               # マイグレーションファイル
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## 実装ルール（必ず守ること）

### バックエンド（TypeScript / Hono）

- `any` 型の使用を禁止する（`unknown` + 型ガードで代替）
- リクエストのバリデーションは **zod** で行い、Honoの `zValidator` ミドルウェアと組み合わせる
- **ルート → サービス → リポジトリ** の3層構造を厳守する
- DBアクセスはすべて `repositories/` に集約し、ルートやサービスから直接Prismaを呼ばない
- 環境変数は起動時にzodでバリデーションし、欠落時は即時エラーで終了する
- エラーハンドリングはHonoのエラーハンドラに集約する（各ルートでtry/catchを乱用しない）
- 非同期処理はすべて `async/await` で統一する（コールバック・Promiseチェーンは使わない）

### フロントエンド（TypeScript / React）

- `any` 型の使用を禁止する（`unknown` + 型ガードで代替）
- コンポーネントはすべて関数コンポーネントで実装する
- API呼び出しは **TanStack Query のカスタムフック** に集約する（直接 fetch しない）
- フォームは **React Hook Form + zod** で実装する
- Server Component と Client Component を適切に使い分ける
- `"use client"` は本当に必要な場合のみ付与する（イベントハンドラ・ブラウザAPIが必要な場合）
- 型定義は `types/` に集約し、APIレスポンス型はバックエンドのzodスキーマと一致させる

### 共通

- **secret は絶対にコミットしない**
- `.env` ファイルはすべて `.gitignore` に含まれていることを確認してから作業する
- コミットメッセージは Conventional Commits に従う
  ```
  feat(video): add presigned URL generation
  fix(auth): handle token refresh error
  chore(deps): update hono to v4
  ```
- PRは機能単位で小さく作る

---

## 認証フロー

認証はすべて **Supabase Auth** に委譲する。

```
フロントエンド
  ├── supabase.auth.signInWithOAuth({ provider: 'google' })  # Googleログイン
  ├── supabase.auth.signUp({ email, password })               # メール登録
  ├── supabase.auth.signInWithPassword({ email, password })   # メールログイン
  └── supabase.auth.resetPasswordForEmail(email)              # パスワードリセット

HonoサーバーはSupabase JWT SecretでJWT署名検証のみ行う
  └── payload.sub = Supabase の user.id（uuid）
```

**重要:** HonoサーバーにはSupabase Authに関する `/auth/*` エンドポイントを実装しない。

### JWT検証ミドルウェアの実装方針

```typescript
// src/middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'

export const authMiddleware = createMiddleware(async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: { code: 'UNAUTHORIZED', message: 'Missing token' } }, 401)

  const payload = await verify(token, process.env.SUPABASE_JWT_SECRET!)
  c.set('userId', payload.sub as string)
  await next()
})
```

### Supabase Auth トリガー（必ずマイグレーションに含める）

```sql
-- auth.users 作成時に public.users へ自動挿入
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, auth_provider)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

## 動画アップロードフロー

HonoサーバーをProxyとして経由しない（メモリ・帯域コスト削減のため）。

```
1. POST /api/v1/videos
   └── メタデータをDBに保存（status: uploading）
   └── R2のPresigned URL（PUT用、有効期限15分）を発行してフロントに返す

2. フロントエンド → R2へ直接PUT
   └── Honoサーバーは経由しない

3. POST /api/v1/videos/:id/complete
   └── アップロード完了をHonoサーバーに通知

4. HonoサーバーがR2からダウンロード → fluent-ffmpegでサムネイル生成・メタデータ抽出
   └── status: processing

5. videos.status を ready に更新
```

### statusの遷移

```
uploading → processing → ready
                └──────→ error（リトライ可能）
```

---

## Prismaスキーマ方針

- `schema.prisma` でモデルを定義し `npx prisma migrate dev` でマイグレーションを管理する
- Supabase Auth のトリガーは Prisma で管理できないため、`prisma/migrations/` に手動SQLファイルとして追加する
- `users` モデルの `id` は Supabase Auth の `auth.users.id` と一致させる（`@default(dbgenerated("gen_random_uuid()"))`）
- すべてのモデルに `createdAt` / `updatedAt` を持たせる（`@updatedAt` を使用）

```prisma
// prisma/schema.prisma の基本方針
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## APIエンドポイント一覧

ベースURL: `/api/v1`
認証: `Authorization: Bearer <Supabase JWT>`

### Users
| メソッド | パス | 概要 |
|---------|------|------|
| GET | /users/me | プロフィール取得 |
| PATCH | /users/me | プロフィール更新 |
| DELETE | /users/me | アカウント削除 |

### Videos
| メソッド | パス | 概要 |
|---------|------|------|
| GET | /videos | 動画一覧（フィルタ・ページネーション） |
| POST | /videos | メタデータ登録・Presigned URL発行 |
| GET | /videos/:id | 動画詳細取得 |
| PATCH | /videos/:id | タイトル・説明・公開設定更新 |
| DELETE | /videos/:id | 動画削除（R2も削除） |
| POST | /videos/:id/complete | アップロード完了・ffmpeg処理開始 |
| GET | /videos/:id/stream | 署名付き再生URL取得 |
| PUT | /videos/:id/tags | タグ一括更新 |

### Comments
| メソッド | パス | 概要 |
|---------|------|------|
| GET | /videos/:id/comments | コメント一覧 |
| POST | /videos/:id/comments | コメント投稿 |
| PATCH | /videos/:id/comments/:cid | コメント編集（自分のみ） |
| DELETE | /videos/:id/comments/:cid | コメント削除（自分のみ） |

### Timestamp Comments
| メソッド | パス | 概要 |
|---------|------|------|
| GET | /videos/:id/timestamp-comments | 全タイムスタンプコメント取得 |
| POST | /videos/:id/timestamp-comments | タイムスタンプコメント投稿 |
| PATCH | /videos/:id/timestamp-comments/:tid | 編集（自分のみ） |
| DELETE | /videos/:id/timestamp-comments/:tid | 削除（自分のみ） |

### Tags & Categories
| メソッド | パス | 概要 |
|---------|------|------|
| GET | /categories | カテゴリ一覧（システム共通） |
| GET | /tags | タグ一覧（共通＋自分の独自タグ） |
| POST | /tags | 独自タグ作成 |
| PATCH | /tags/:id | 独自タグ更新（自分のみ） |
| DELETE | /tags/:id | 独自タグ削除（自分のみ） |

### GET /videos クエリパラメータ
```
?tag_ids=uuid1,uuid2   タグで絞り込み（カンマ区切り）
&visibility=private    private / public
&status=ready          動画ステータスで絞り込み
&q=キーワード          タイトル・説明の全文検索
&sort=recorded_at      ソートキー（recorded_at / created_at）
&order=desc            ソート順（asc / desc）
&limit=20              ページサイズ（最大100）
&cursor=xxx            カーソルベースページネーション
```

---

## 環境変数

### frontend/.env.local

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
```

### backend/.env

```
PORT=8080
SUPABASE_JWT_SECRET=<Supabase管理画面 > Settings > API > JWT Secret>
DATABASE_URL=postgresql://postgres:[password]@db.xxx.supabase.co:5432/postgres
R2_ACCOUNT_ID=<Cloudflare Account ID>
R2_ACCESS_KEY_ID=<R2 Access Key>
R2_SECRET_ACCESS_KEY=<R2 Secret Key>
R2_BUCKET_NAME=sparlog-videos
R2_PUBLIC_DOMAIN=https://xxx.r2.dev
```

---

## 実装フェーズ

### Phase 1: バックエンド基盤
1. Honoプロジェクト初期化（TypeScript・tsx・@hono/node-server）
2. 環境変数バリデーション（zod）
3. Prismaセットアップ・スキーマ定義
4. DBマイグレーション（全テーブル・インデックス・Supabase Authトリガー）
5. Supabase JWT検証ミドルウェア実装
6. ユーザーAPI（GET/PATCH/DELETE /users/me）

### Phase 2: バックエンド動画機能
1. Cloudflare R2クライアント（@aws-sdk/client-s3・@aws-sdk/s3-request-presigner）
2. Presigned URL発行（アップロード・取得）
3. fluent-ffmpegラッパー（サムネイル生成・メタデータ抽出）
4. 動画API（CRUD・complete・stream）
5. タグ・カテゴリAPI

### Phase 3: バックエンドコメント機能
1. コメントAPI（CRUD）
2. タイムスタンプコメントAPI（CRUD）

### Phase 4: フロントエンド基盤
1. Next.jsプロジェクト初期化（TypeScript・TailwindCSS・shadcn/ui）
2. Supabase Authセットアップ（@supabase/ssr）
3. ログイン・新規登録・パスワードリセット画面
4. 認証ミドルウェア（middleware.ts）・レイアウト（サイドバー）
5. Hono APIクライアント関数（lib/api/）

### Phase 5: フロントエンド主要機能
1. 動画一覧画面（グリッド・検索・タグフィルタ・ページネーション）
2. 動画アップロード画面（ドロップゾーン・Presigned URL・プログレスバー）
3. 動画詳細・再生画面（Video.js・タイムスタンプコメント）
4. タグ管理画面
5. プロフィール設定画面

### Phase 6: 仕上げ
1. エラーハンドリング・ローディングUI
2. レスポンシブ対応
3. Vercel・Renderデプロイ設定
4. GitHub Actions CI/CD（lint・test・build）

---

## v2で追加予定（現時点では実装しない）

- チーム・ジム単位での動画共有（teams・team_members・video_sharesテーブル追加）
- HLSアダプティブストリーミング（fluent-ffmpegでHLS変換・hls.js再生）
- 練習統計ダッシュボード
- AIハイライト抽出
- GCPへのインフラ移行（Cloud Run + Cloud SQL + Terraform）
