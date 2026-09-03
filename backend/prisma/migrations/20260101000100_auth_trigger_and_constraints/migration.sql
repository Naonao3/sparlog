-- Prisma では表現できない Supabase 固有の設定を手動SQLで管理する。
--   1. auth.users → public.users への自動挿入トリガー
--   2. public.users.id から auth.users.id への外部キー
--   3. システム共通タグ名の部分ユニークインデックス
--   4. 全テーブルの RLS 有効化（anon キー経由の PostgREST 直アクセスを遮断）

-- ---------------------------------------------------------------------------
-- 1. auth.users 作成時に public.users へ自動挿入
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, avatar_url, auth_provider, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- auth スキーマは Supabase 上にのみ存在するため、ローカル Postgres では静かにスキップする
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

    -- 2. auth.users が削除されたらアプリ側のユーザーも消す
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'users_id_auth_users_fkey'
    ) THEN
      ALTER TABLE public.users
        ADD CONSTRAINT users_id_auth_users_fkey
        FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 3. システム共通タグ（user_id IS NULL）の名前重複を防ぐ
--    ユーザー独自タグは tags_user_id_name_key（Prisma 側の @@unique）で担保される
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS tags_system_name_key
  ON public.tags (name)
  WHERE user_id IS NULL;

-- ---------------------------------------------------------------------------
-- 4. RLS を有効化する。
--    ポリシーを作らない = anon / authenticated ロールからは一切読み書きできない。
--    API サーバーはテーブル所有者ロールで接続するため RLS をバイパスする。
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timestamp_comments ENABLE ROW LEVEL SECURITY;
