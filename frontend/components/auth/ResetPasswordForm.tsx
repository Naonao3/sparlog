'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { confirmResetPassword, resetPassword } from 'aws-amplify/auth'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toAuthErrorMessage } from '@/lib/auth/errors'

const requestSchema = z.object({
  email: z.string().min(1, 'メールアドレスを入力してください').email('メールアドレスの形式が正しくありません'),
})

const confirmSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, '6桁の数字を入力してください'),
    password: z.string().min(8, 'パスワードは8文字以上で入力してください').max(256),
    confirmPassword: z.string().min(1, '確認用パスワードを入力してください'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'パスワードが一致しません',
  })

type RequestFormValues = z.infer<typeof requestSchema>
type ConfirmFormValues = z.infer<typeof confirmSchema>

/**
 * パスワード再設定。Cognito はメールで確認コードを送るので、
 * 1. メールアドレスを入力してコードを送信 → 2. コードと新しいパスワードを入力 の2段階にする。
 */
export function ResetPasswordForm() {
  const [email, setEmail] = useState<string | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>パスワードの再設定</CardTitle>
        <CardDescription>
          {email === null
            ? '登録済みのメールアドレスに確認コードを送信します。'
            : `${email} に届いた6桁の確認コードと、新しいパスワードを入力してください。`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {email === null ? (
          <RequestCodeForm onSent={setEmail} />
        ) : (
          <ConfirmNewPasswordForm email={email} onBack={() => setEmail(null)} />
        )}

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            ログイン画面に戻る
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

function RequestCodeForm({ onSent }: { onSent: (email: string) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: '' },
  })

  async function onSubmit(values: RequestFormValues): Promise<void> {
    try {
      await resetPassword({ username: values.email })
      toast.success('確認コードを送信しました', {
        description: 'メールが届かない場合は、メールアドレスをご確認ください。',
      })
      onSent(values.email)
    } catch (error: unknown) {
      toast.error('確認コードを送信できませんでした', { description: toAuthErrorMessage(error) })
    }
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
      <div className="space-y-2">
        <Label htmlFor="email">メールアドレス</Label>
        <Input id="email" type="email" autoComplete="email" {...register('email')} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? '送信中…' : '確認コードを送信'}
      </Button>
    </form>
  )
}

function ConfirmNewPasswordForm({ email, onBack }: { email: string; onBack: () => void }) {
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ConfirmFormValues>({
    resolver: zodResolver(confirmSchema),
    defaultValues: { code: '', password: '', confirmPassword: '' },
  })

  async function onSubmit(values: ConfirmFormValues): Promise<void> {
    try {
      await confirmResetPassword({
        username: email,
        confirmationCode: values.code,
        newPassword: values.password,
      })
      toast.success('パスワードを再設定しました', { description: '新しいパスワードでログインしてください。' })
      router.push('/login')
    } catch (error: unknown) {
      toast.error('パスワードを再設定できませんでした', { description: toAuthErrorMessage(error) })
    }
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
      <div className="space-y-2">
        <Label htmlFor="code">確認コード</Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          {...register('code')}
        />
        {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">新しいパスワード（8文字以上）</Label>
        <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">新しいパスワード（確認）</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? '更新中…' : 'パスワードを再設定'}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
        メールアドレスを入力し直す
      </Button>
    </form>
  )
}
