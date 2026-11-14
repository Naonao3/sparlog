-- 認証を Supabase Auth から Amazon Cognito に移行したため、Supabase 固有のユーザー作成の仕組みを外す。
-- users 行は API の認証ミドルウェアが初回リクエスト時に作成する（id = Cognito の sub）。
--
-- RDS など auth スキーマが無い環境では、トリガーと外部キーはもともと作られていないので何もしない。

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  END IF;
END
$$;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_auth_users_fkey;

DROP FUNCTION IF EXISTS public.handle_new_user();
