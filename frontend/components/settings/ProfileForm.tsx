'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useDeleteAccount, useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils/format'

const profileSchema = z.object({
  displayName: z.string().trim().min(1, '表示名を入力してください').max(50),
  avatarUrl: z.union([z.string().url('URLの形式が正しくありません'), z.literal('')]),
  bio: z.string().trim().max(500),
})

type ProfileFormValues = z.infer<typeof profileSchema>

export function ProfileForm() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: profile, isPending, isError } = useProfile()
  const updateProfile = useUpdateProfile()
  const deleteAccount = useDeleteAccount()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: '', avatarUrl: '', bio: '' },
  })

  // 初回にプロフィールが届いたときだけフォームへ流し込む
  // （再取得のたびに reset すると入力中の内容が消えてしまう）
  const isInitializedRef = useRef(false)
  useEffect(() => {
    if (!profile || isInitializedRef.current) return
    isInitializedRef.current = true
    reset({
      displayName: profile.displayName ?? '',
      avatarUrl: profile.avatarUrl ?? '',
      bio: profile.bio ?? '',
    })
  }, [profile, reset])

  async function onSubmit(values: ProfileFormValues): Promise<void> {
    try {
      const updated = await updateProfile.mutateAsync({
        displayName: values.displayName,
        avatarUrl: values.avatarUrl.length > 0 ? values.avatarUrl : null,
        bio: values.bio.length > 0 ? values.bio : null,
      })
      // 保存後の値を新しい初期値にして isDirty を解除する
      reset({
        displayName: updated.displayName ?? '',
        avatarUrl: updated.avatarUrl ?? '',
        bio: updated.bio ?? '',
      })
      toast.success('プロフィールを更新しました')
    } catch (error: unknown) {
      toast.error('更新に失敗しました', {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  async function handleDeleteAccount(): Promise<void> {
    try {
      await deleteAccount.mutateAsync()
      const supabase = createClient()
      await supabase.auth.signOut()
      queryClient.clear()
      toast.success('アカウントを削除しました')
      router.push('/login')
      router.refresh()
    } catch (error: unknown) {
      toast.error('アカウントを削除できませんでした', {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (isError || !profile) {
    return <p className="text-sm text-destructive">プロフィールを読み込めませんでした。</p>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>プロフィール</CardTitle>
          <CardDescription>
            {profile.email}（{profile.authProvider === 'google' ? 'Googleログイン' : 'メールログイン'}
            ・{formatDate(profile.createdAt)}に登録）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
            <div className="space-y-2">
              <Label htmlFor="displayName">表示名</Label>
              <Input id="displayName" {...register('displayName')} />
              {errors.displayName && (
                <p className="text-xs text-destructive">{errors.displayName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatarUrl">アバター画像URL</Label>
              <Input id="avatarUrl" placeholder="https://…" {...register('avatarUrl')} />
              {errors.avatarUrl && (
                <p className="text-xs text-destructive">{errors.avatarUrl.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">自己紹介</Label>
              <Textarea id="bio" rows={3} placeholder="競技歴・所属ジムなど" {...register('bio')} />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={!isDirty || updateProfile.isPending}>
                {updateProfile.isPending ? '保存中…' : '保存'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">アカウントの削除</CardTitle>
          <CardDescription>
            アップロードした動画・コメント・タグがすべて削除されます。取り消せません。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">アカウントを削除</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>本当にアカウントを削除しますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  すべての動画とコメントが完全に削除されます。この操作は取り消せません。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={(event) => {
                    event.preventDefault()
                    void handleDeleteAccount()
                  }}
                  disabled={deleteAccount.isPending}
                >
                  {deleteAccount.isPending ? '削除中…' : '削除する'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  )
}
