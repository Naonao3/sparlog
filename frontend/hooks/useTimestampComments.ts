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
import type {
  CreateTimestampCommentInput,
  TimestampComment,
  UpdateTimestampCommentInput,
} from '@/types'

export function useTimestampComments(
  videoId: string,
): UseQueryResult<TimestampComment[], Error> {
  return useQuery({
    queryKey: queryKeys.timestampComments(videoId),
    queryFn: () => commentsApi.listTimestampComments(videoId),
    enabled: videoId.length > 0,
  })
}

export function useCreateTimestampComment(
  videoId: string,
): UseMutationResult<TimestampComment, Error, CreateTimestampCommentInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTimestampCommentInput) =>
      commentsApi.createTimestampComment(videoId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.timestampComments(videoId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.videos.detail(videoId) })
    },
  })
}

export function useUpdateTimestampComment(
  videoId: string,
): UseMutationResult<
  TimestampComment,
  Error,
  { commentId: string; input: UpdateTimestampCommentInput }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      commentId,
      input,
    }: {
      commentId: string
      input: UpdateTimestampCommentInput
    }) => commentsApi.updateTimestampComment(videoId, commentId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.timestampComments(videoId) })
    },
  })
}

export function useDeleteTimestampComment(
  videoId: string,
): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) => commentsApi.deleteTimestampComment(videoId, commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.timestampComments(videoId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.videos.detail(videoId) })
    },
  })
}
