'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useUpdateComment,
} from '@/hooks/useComments'
import { useProfile } from '@/hooks/useProfile'
import { formatDateTime } from '@/lib/utils/format'

export function CommentSection({ videoId }: { videoId: string }) {
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState('')

  const { data: profile } = useProfile()
  const { data: comments, isPending, isError } = useComments(videoId)
  const createComment = useCreateComment(videoId)
  const updateComment = useUpdateComment(videoId)
  const deleteComment = useDeleteComment(videoId)

  async function handleCreate(): Promise<void> {
    const body = draft.trim()
    if (body.length === 0) return

    try {
      await createComment.mutateAsync({ body })
      setDraft('')
    } catch (error: unknown) {
      toast.error('コメントを投稿できませんでした', {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  async function handleUpdate(commentId: string): Promise<void> {
    const body = editingBody.trim()
    if (body.length === 0) return

    try {
      await updateComment.mutateAsync({ commentId, body })
      setEditingId(null)
    } catch (error: unknown) {
      toast.error('コメントを更新できませんでした', {
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
      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="動画全体へのメモを書く"
          rows={3}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => void handleCreate()}
            disabled={draft.trim().length === 0 || createComment.isPending}
          >
            {createComment.isPending ? '投稿中…' : 'メモを追加'}
          </Button>
        </div>
      </div>

      {isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">コメントを読み込めませんでした。</p>
      ) : comments.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">まだメモがありません。</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((comment) => {
            const isOwn = profile?.id === comment.author.id
            const name = comment.author.displayName ?? 'ユーザー'

            return (
              <li key={comment.id} className="flex gap-3">
                <Avatar className="h-8 w-8">
                  {comment.author.avatarUrl ? (
                    <AvatarImage src={comment.author.avatarUrl} alt={name} />
                  ) : null}
                  <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{name}</span>
                    <span>{formatDateTime(comment.createdAt)}</span>
                    {comment.updatedAt !== comment.createdAt && <span>（編集済み）</span>}
                  </div>

                  {editingId === comment.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editingBody}
                        onChange={(event) => setEditingBody(event.target.value)}
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => void handleUpdate(comment.id)}>
                          保存
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          キャンセル
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words text-sm">{comment.body}</p>
                  )}
                </div>

                {isOwn && editingId !== comment.id && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      aria-label="編集"
                      onClick={() => {
                        setEditingId(comment.id)
                        setEditingBody(comment.body)
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      aria-label="削除"
                      onClick={() => void handleDelete(comment.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
