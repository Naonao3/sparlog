'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { resendSignUpCode, signIn } from 'aws-amplify/auth'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useVerifyAccount } from '@/hooks/useAuth'
import { toAuthErrorMessage } from '@/lib/auth/errors'
import { takeLoginMessage, toSafeRedirectPath } from '@/lib/auth/redirect'

const loginSchema = z.object({
  email: z.string().min(1, 'メールアドレスを入力してください').email('メールアドレスの形式が正しくありません'),
  password: z.string().min(1, 'パスワードを入力してください'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = toSafeRedirectPath(searchParams.get('redirectTo'))
  const verifyAccount = useVerifyAccount()

  // Google ログインの失敗や、別のログイン方法で登録済みだった場合のメッセージを表示する
  useEffect(() => {
    const message = takeLoginMessage()
    if (message) toast.error('ログインできませんでした', { description: message })
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginFormValues): Promise<void> {
    try {
      const { nextStep } = await signIn({ username: values.email, password: values.password })

      switch (nextStep.signInStep) {
        case 'DONE': {
          if (!(await verifyAccount())) {
            const message = takeLoginMessage()
            toast.error('ログインできませんでした', { description: message ?? undefined })
            return
          }
          router.push(redirectTo)
          router.refresh()
          return
        }
        case 'CONFIRM_SIGN_UP': {
          // メール確認が済んでいない。コードを送り直して確認画面へ
          await resendSignUpCode({ username: values.email })
          toast.info('メールアドレスの確認が完了していません', {
            description: '確認コードを再送しました。メールをご確認ください。',
          })
          router.push(`/confirm-signup?email=${encodeURIComponent(values.email)}`)
          return
        }
        case 'RESET_PASSWORD': {
          toast.info('パスワードの再設定が必要です')
          router.push('/reset-password')
          return
        }
        default: {
          toast.error('ログインに失敗しました', {
            description: `未対応のログイン手順です（${nextStep.signInStep}）`,
          })
        }
      }
    } catch (error: unknown) {
      toast.error('ログインに失敗しました', { description: toAuthErrorMessage(error) })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ログイン</CardTitle>
        <CardDescription>練習動画を振り返るにはログインしてください。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <GoogleSignInButton redirectTo={redirectTo} />

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">または</span>
          </div>
        </div>

        <form className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">パスワード</Label>
              <Link
                href="/reset-password"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                パスワードをお忘れですか？
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'ログイン中…' : 'ログイン'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          アカウントをお持ちでないですか？{' '}
          <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
            新規登録
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
