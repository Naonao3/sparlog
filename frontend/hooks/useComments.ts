'use client'

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import * as commentsApi from '@/lib/api/comments'
import { queryKeys } from '@/lib/api/queryKeys'
import type { Comment, CreateCommentInput } from '@/types'

export function useComments(videoId: string): UseQueryResult<Comment[], Error> {
  return useQuery({
    queryKey: queryKeys.comments(videoId),
    queryFn: () => commentsApi.listComments(videoId),
    enabled: videoId.length > 0,
  })
}

export function useCreateComment(
  videoId: string,
): UseMutationResult<Comment, Error, CreateCommentInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCommentInput) => commentsApi.createComment(videoId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.comments(videoId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.videos.detail(videoId) })
    },
  })
}

export function useUpdateComment(
  videoId: string,
): UseMutationResult<Comment, Error, { commentId: string; body: string }> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      commentsApi.updateComment(videoId, commentId, { body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.comments(videoId) })
    },
  })
}

export function useDeleteComment(videoId: string): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) => commentsApi.deleteComment(videoId, commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.comments(videoId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.videos.detail(videoId) })
    },
  })
}
