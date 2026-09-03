'use client'

import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
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
import { useDeleteVideo } from '@/hooks/useVideos'

export function DeleteVideoButton({ videoId, title }: { videoId: string; title: string }) {
  const router = useRouter()
  const deleteVideo = useDeleteVideo()

  async function handleDelete(): Promise<void> {
    try {
      await deleteVideo.mutateAsync(videoId)
      toast.success('動画を削除しました')
      router.push('/videos')
    } catch (error: unknown) {
      toast.error('削除に失敗しました', {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
          削除
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>「{title}」を削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            動画ファイル・サムネイル・コメントがすべて削除されます。この操作は取り消せません。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(event) => {
              event.preventDefault()
              void handleDelete()
            }}
            disabled={deleteVideo.isPending}
          >
            {deleteVideo.isPending ? '削除中…' : '削除する'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
