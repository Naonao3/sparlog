'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { autoSignIn, confirmSignUp, resendSignUpCode } from 'aws-amplify/auth'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useVerifyAccount } from '@/hooks/useAuth'
import { toAuthErrorMessage } from '@/lib/auth/errors'

const confirmSchema = z.object({
  email: z.string().min(1, 'メールアドレスを入力してください').email('メールアドレスの形式が正しくありません'),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, '6桁の数字を入力してください'),
})

type ConfirmFormValues = z.infer<typeof confirmSchema>

/** 新規登録後にメールで届く確認コードを入力する */
export function ConfirmSignUpForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const verifyAccount = useVerifyAccount()
  const [isResending, setIsResending] = useState(false)

  const {
    register,
    handleSubmit,
    getValues,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<ConfirmFormValues>({
    resolver: zodResolver(confirmSchema),
    defaultValues: { email: searchParams.get('email') ?? '', code: '' },
  })

  /** 新規登録画面から来た場合はそのままログインし、そうでなければログイン画面へ */
  async function signInAfterConfirm(): Promise<void> {
    try {
      const { nextStep } = await autoSignIn()
      if (nextStep.signInStep === 'DONE' && (await verifyAccount())) {
        toast.success('登録が完了しました')
        router.push('/videos')
        router.refresh()
        return
      }
    } catch {
      // 別のタブ・ページ再読み込み後などは自動ログインできない
    }
    toast.success('登録が完了しました', { description: 'ログインしてください。' })
    router.push('/login')
  }

  async function onSubmit(values: ConfirmFormValues): Promise<void> {
    try {
      const { nextStep } = await confirmSignUp({
        username: values.email,
        confirmationCode: values.code,
      })

      if (nextStep.signUpStep === 'COMPLETE_AUTO_SIGN_IN') {
        await signInAfterConfirm()
        return
      }

      toast.success('登録が完了しました', { description: 'ログインしてください。' })
      router.push('/login')
    } catch (error: unknown) {
      toast.error('確認に失敗しました', { description: toAuthErrorMessage(error) })
    }
  }

  async function handleResend(): Promise<void> {
    if (!(await trigger('email'))) return
    setIsResending(true)
    try {
      await resendSignUpCode({ username: getValues('email') })
      toast.success('確認コードを再送しました')
    } catch (error: unknown) {
      toast.error('再送に失敗しました', { description: toAuthErrorMessage(error) })
    } finally {
      setIsResending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>メールアドレスの確認</CardTitle>
        <CardDescription>メールに届いた6桁の確認コードを入力してください。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

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

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? '確認中…' : '確認して登録を完了'}
          </Button>
        </form>

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => void handleResend()}
          disabled={isResending}
        >
          {isResending ? '送信中…' : '確認コードを再送する'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            ログイン画面に戻る
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
