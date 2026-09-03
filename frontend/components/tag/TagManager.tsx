'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { TagBadge } from '@/components/video/TagBadge'
import { useCategories, useCreateTag, useDeleteTag, useTags } from '@/hooks/useTags'
import type { Tag } from '@/types'

const PRESET_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
]

const NO_CATEGORY = 'none'

function TagRow({ tag }: { tag: Tag }) {
  const deleteTag = useDeleteTag()

  async function handleDelete(): Promise<void> {
    try {
      await deleteTag.mutateAsync(tag.id)
      toast.success(`タグ「${tag.name}」を削除しました`)
    } catch (error: unknown) {
      toast.error('タグを削除できませんでした', {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <TagBadge tag={tag} />
        {tag.category && (
          <span className="truncate text-xs text-muted-foreground">{tag.category.name}</span>
        )}
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="削除">
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>タグ「{tag.name}」を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              このタグは動画からも取り外されます。動画自体は削除されません。
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
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}

export function TagManager() {
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(PRESET_COLORS[0] ?? '#ef4444')
  const [categoryId, setCategoryId] = useState<string>(NO_CATEGORY)

  const { data: tags, isPending } = useTags()
  const { data: categories } = useCategories()
  const createTag = useCreateTag()

  const systemTags = tags?.filter((tag) => tag.isSystem) ?? []
  const myTags = tags?.filter((tag) => !tag.isSystem) ?? []

  async function handleCreate(): Promise<void> {
    const trimmed = name.trim()
    if (trimmed.length === 0) return

    try {
      await createTag.mutateAsync({
        name: trimmed,
        color,
        ...(categoryId === NO_CATEGORY ? {} : { categoryId }),
      })
      setName('')
      toast.success(`タグ「${trimmed}」を作成しました`)
    } catch (error: unknown) {
      toast.error('タグを作成できませんでした', {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>タグを作成</CardTitle>
          <CardDescription>自分専用のタグを追加できます。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tag-name">タグ名</Label>
              <Input
                id="tag-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例: 左ミドル"
                maxLength={30}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tag-category">カテゴリ</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="tag-category">
                  <SelectValue placeholder="未分類" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>未分類</SelectItem>
                  {(categories ?? []).map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>カラー</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColor(preset)}
                  aria-label={`カラー ${preset}`}
                  aria-pressed={color === preset}
                  style={{ backgroundColor: preset }}
                  className={`h-7 w-7 rounded-full transition-transform ${
                    color === preset ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : ''
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => void handleCreate()}
              disabled={name.trim().length === 0 || createTag.isPending}
            >
              <Plus className="h-4 w-4" />
              {createTag.isPending ? '作成中…' : 'タグを作成'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>自分のタグ</CardTitle>
          <CardDescription>作成したタグは編集・削除できます。</CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : myTags.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              まだ自分のタグがありません。上のフォームから作成できます。
            </p>
          ) : (
            <ul className="space-y-2">
              {myTags.map((tag) => (
                <TagRow key={tag.id} tag={tag} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>共通タグ</CardTitle>
          <CardDescription>
            すべてのユーザーが使えるタグです。編集・削除はできません。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {systemTags.map((tag) => (
                <TagBadge key={tag.id} tag={tag} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
