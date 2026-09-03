'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { TagSelector } from '@/components/video/TagSelector'
import { useUpdateVideo, useUpdateVideoTags } from '@/hooks/useVideos'
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/utils/format'
import type { Video, Visibility } from '@/types'

const editSchema = z.object({
  title: z.string().trim().min(1, 'タイトルを入力してください').max(200),
  description: z.string().trim().max(5000),
  recordedAt: z.string(),
  visibility: z.enum(['PRIVATE', 'PUBLIC']),
})

type EditFormValues = z.infer<typeof editSchema>

export function VideoEditDialog({ video }: { video: Video }) {
  const [open, setOpen] = useState(false)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(video.tags.map((tag) => tag.id))

  const updateVideo = useUpdateVideo(video.id)
  const updateTags = useUpdateVideoTags(video.id)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      title: video.title,
      description: video.description ?? '',
      recordedAt: toDateTimeLocalValue(video.recordedAt),
      visibility: video.visibility,
    },
  })

  // ダイアログを開き直したときに最新の値へ戻す
  useEffect(() => {
    if (!open) return
    reset({
      title: video.title,
      description: video.description ?? '',
      recordedAt: toDateTimeLocalValue(video.recordedAt),
      visibility: video.visibility,
    })
    setSelectedTagIds(video.tags.map((tag) => tag.id))
  }, [open, video, reset])

  async function onSubmit(values: EditFormValues): Promise<void> {
    try {
      await updateVideo.mutateAsync({
        title: values.title,
        description: values.description.length > 0 ? values.description : null,
        visibility: values.visibility,
        recordedAt: fromDateTimeLocalValue(values.recordedAt),
      })

      const currentTagIds = video.tags.map((tag) => tag.id)
      const changed =
        currentTagIds.length !== selectedTagIds.length ||
        currentTagIds.some((id) => !selectedTagIds.includes(id))

      if (changed) await updateTags.mutateAsync(selectedTagIds)

      toast.success('動画情報を更新しました')
      setOpen(false)
    } catch (error: unknown) {
      toast.error('更新に失敗しました', {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  const isSaving = updateVideo.isPending || updateTags.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4" />
          編集
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>動画情報の編集</DialogTitle>
          <DialogDescription>タイトル・メモ・公開設定・タグを変更できます。</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <div className="space-y-2">
            <Label htmlFor="edit-title">タイトル</Label>
            <Input id="edit-title" {...register('title')} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">説明・メモ</Label>
            <Textarea id="edit-description" rows={4} {...register('description')} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-recordedAt">撮影日時</Label>
              <Input id="edit-recordedAt" type="datetime-local" {...register('recordedAt')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-visibility">公開設定</Label>
              <Select
                value={watch('visibility')}
                onValueChange={(value) => setValue('visibility', value as Visibility)}
              >
                <SelectTrigger id="edit-visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIVATE">非公開</SelectItem>
                  <SelectItem value="PUBLIC">公開</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>タグ</Label>
            <TagSelector
              selectedIds={selectedTagIds}
              onToggle={(tagId) =>
                setSelectedTagIds((current) =>
                  current.includes(tagId)
                    ? current.filter((id) => id !== tagId)
                    : [...current, tagId],
                )
              }
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
