'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { FileVideo, UploadCloud, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState, type DragEvent } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { TagSelector } from '@/components/video/TagSelector'
import { useCompleteVideoUpload, useCreateVideo } from '@/hooks/useVideos'
import { uploadToPresignedUrl } from '@/lib/api/client'
import { formatFileSize, fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/utils/format'
import {
  MAX_UPLOAD_BYTES,
  fileNameWithoutExtension,
  resolveVideoMimeType,
} from '@/lib/utils/video'
import type { Visibility } from '@/types'

const uploadSchema = z.object({
  title: z.string().trim().min(1, 'タイトルを入力してください').max(200),
  description: z.string().trim().max(5000).optional(),
  recordedAt: z.string().optional(),
  visibility: z.enum(['PRIVATE', 'PUBLIC']),
})

type UploadFormValues = z.infer<typeof uploadSchema>

type UploadPhase = 'idle' | 'creating' | 'uploading' | 'completing'

export function UploadForm() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [phase, setPhase] = useState<UploadPhase>('idle')
  const [progress, setProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const createVideo = useCreateVideo()
  const completeUpload = useCompleteVideoUpload()

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: { title: '', description: '', recordedAt: '', visibility: 'PRIVATE' },
  })

  const isBusy = phase !== 'idle'

  function acceptFile(nextFile: File): void {
    if (resolveVideoMimeType(nextFile) === null) {
      toast.error('対応していない動画形式です', {
        description: 'mp4 / mov / webm / mkv / avi / mpeg のいずれかを選択してください。',
      })
      return
    }

    if (nextFile.size > MAX_UPLOAD_BYTES) {
      toast.error('ファイルサイズが大きすぎます', {
        description: `上限は ${formatFileSize(MAX_UPLOAD_BYTES)} です。`,
      })
      return
    }

    setFile(nextFile)
    setValue('title', fileNameWithoutExtension(nextFile.name), { shouldValidate: true })
    if (nextFile.lastModified > 0) {
      setValue('recordedAt', toDateTimeLocalValue(new Date(nextFile.lastModified).toISOString()))
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    setIsDragging(false)
    const dropped = event.dataTransfer.files[0]
    if (dropped) acceptFile(dropped)
  }

  async function onSubmit(values: UploadFormValues): Promise<void> {
    if (!file) {
      toast.error('動画ファイルを選択してください')
      return
    }

    const mimeType = resolveVideoMimeType(file)
    if (!mimeType) {
      toast.error('対応していない動画形式です')
      return
    }

    try {
      // 1. メタデータ登録 → Presigned URL を受け取る
      setPhase('creating')
      const recordedAtIso = values.recordedAt ? fromDateTimeLocalValue(values.recordedAt) : null
      const created = await createVideo.mutateAsync({
        title: values.title,
        ...(values.description ? { description: values.description } : {}),
        fileName: file.name,
        mimeType,
        fileSize: file.size,
        ...(recordedAtIso ? { recordedAt: recordedAtIso } : {}),
        visibility: values.visibility,
        ...(selectedTagIds.length > 0 ? { tagIds: selectedTagIds } : {}),
      })

      // 2. R2 へ直接 PUT（API サーバーは経由しない）
      setPhase('uploading')
      setProgress(0)
      await uploadToPresignedUrl({
        url: created.upload.url,
        file,
        headers: created.upload.headers,
        onProgress: setProgress,
      })

      // 3. 完了通知（サーバー側で ffmpeg 処理が始まる）
      setPhase('completing')
      await completeUpload.mutateAsync(created.video.id)

      toast.success('アップロードが完了しました', {
        description: 'サムネイルの生成が終わると再生できるようになります。',
      })
      router.push(`/videos/${created.video.id}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '不明なエラーが発生しました'
      toast.error('アップロードに失敗しました', { description: message })
      setPhase('idle')
      setProgress(0)
    }
  }

  return (
    <form className="space-y-6" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
      <Card>
        <CardHeader>
          <CardTitle>動画ファイル</CardTitle>
        </CardHeader>
        <CardContent>
          {file ? (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-4">
              <FileVideo className="h-8 w-8 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
              {!isBusy && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setFile(null)}
                  aria-label="ファイルを解除"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ) : (
            <div
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors ${
                isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              <UploadCloud className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">ここに動画をドロップ、またはクリックして選択</p>
              <p className="text-xs text-muted-foreground">
                mp4 / mov / webm / mkv / avi・最大 {formatFileSize(MAX_UPLOAD_BYTES)}
              </p>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(event) => {
              const selected = event.target.files?.[0]
              if (selected) acceptFile(selected)
              event.target.value = ''
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>動画情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">タイトル</Label>
            <Input id="title" disabled={isBusy} {...register('title')} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">説明・メモ</Label>
            <Textarea
              id="description"
              rows={4}
              disabled={isBusy}
              placeholder="意識したこと、反省点など"
              {...register('description')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recordedAt">撮影日時</Label>
              <Input
                id="recordedAt"
                type="datetime-local"
                disabled={isBusy}
                {...register('recordedAt')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="visibility">公開設定</Label>
              <Select
                defaultValue="PRIVATE"
                disabled={isBusy}
                onValueChange={(value) => setValue('visibility', value as Visibility)}
              >
                <SelectTrigger id="visibility">
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
        </CardContent>
      </Card>

      {isBusy && (
        <div className="space-y-2 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span>
              {phase === 'creating' && 'アップロードURLを準備しています…'}
              {phase === 'uploading' && 'アップロード中…'}
              {phase === 'completing' && 'サーバーで処理を開始しています…'}
            </span>
            {phase === 'uploading' && <span className="tabular-nums">{progress}%</span>}
          </div>
          <Progress value={phase === 'uploading' ? progress : phase === 'completing' ? 100 : 5} />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isBusy}>
          キャンセル
        </Button>
        <Button type="submit" disabled={isBusy || !file}>
          {isBusy ? 'アップロード中…' : 'アップロード'}
        </Button>
      </div>
    </form>
  )
}
