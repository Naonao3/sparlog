'use client'

import { Crosshair, Play, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useProfile } from '@/hooks/useProfile'
import {
  useCreateTimestampComment,
  useDeleteTimestampComment,
  useTimestampComments,
} from '@/hooks/useTimestampComments'
import { formatTimestamp, parseTimestamp } from '@/lib/utils/format'
import { usePlayerStore } from '@/stores/player'

export function TimestampCommentPanel({ videoId }: { videoId: string }) {
  const currentTime = usePlayerStore((state) => state.currentTime)
  const requestSeek = usePlayerStore((state) => state.requestSeek)

  const [atInput, setAtInput] = useState('0:00')
  const [body, setBody] = useState('')

  const { data: profile } = useProfile()
  const { data: comments, isPending, isError } = useTimestampComments(videoId)
  const createComment = useCreateTimestampComment(videoId)
  const deleteComment = useDeleteTimestampComment(videoId)

  const parsedAtSec = parseTimestamp(atInput)

  async function handleCreate(): Promise<void> {
    if (parsedAtSec === null) {
      toast.error('再生位置の形式が正しくありません', { description: '例: 1:23' })
      return
    }
    if (body.trim().length === 0) return

    try {
      await createComment.mutateAsync({ atSec: parsedAtSec, body: body.trim() })
      setBody('')
    } catch (error: unknown) {
      toast.error('コメントを投稿できませんでした', {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  async function handleDelete(commentId: string): Promise<void> {
    try {
      await deleteComment.mutateAsync(commentId)
    } catch (error: unknown) {
      toast.error('コメントを削除できませんでした', {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border bg-card p-3">
        <div className="flex items-center gap-2">
          <Input
            value={atInput}
            onChange={(event) => setAtInput(event.target.value)}
            placeholder="1:23"
            className="h-9 w-24 text-center tabular-nums"
            aria-label="再生位置"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAtInput(formatTimestamp(currentTime))}
          >
            <Crosshair className="h-3.5 w-3.5" />
            現在位置
          </Button>
          <span className="text-xs text-muted-foreground">再生中: {formatTimestamp(currentTime)}</span>
        </div>

        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="このシーンで気づいたこと"
          rows={2}
        />

        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => void handleCreate()}
            disabled={body.trim().length === 0 || createComment.isPending}
          >
            {createComment.isPending ? '追加中…' : 'この位置にコメント'}
          </Button>
        </div>
      </div>

      {isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">タイムスタンプコメントを読み込めませんでした。</p>
      ) : comments.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          まだシーンコメントがありません。
        </p>
      ) : (
        <ul className="space-y-1">
          {comments.map((comment) => {
            const isOwn = profile?.id === comment.author.id
            return (
              <li
                key={comment.id}
                className="group flex items-start gap-2 rounded-md p-2 transition-colors hover:bg-accent/50"
              >
                <button
                  type="button"
                  onClick={() => requestSeek(comment.atSec)}
                  className="flex shrink-0 items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs font-medium tabular-nums text-primary transition-colors hover:bg-primary/20"
                  aria-label={`${formatTimestamp(comment.atSec)} から再生`}
                >
                  <Play className="h-3 w-3" />
                  {formatTimestamp(comment.atSec)}
                </button>

                <p className="min-w-0 flex-1 whitespace-pre-wrap break-words pt-1 text-sm">
                  {comment.body}
                </p>

                {isOwn && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-destructive opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label="削除"
                    onClick={() => void handleDelete(comment.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
