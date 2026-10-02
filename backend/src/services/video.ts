import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { env } from '../config/env.js'
import { badRequest, forbidden, notFound, payloadTooLarge } from '../lib/errors.js'
import * as videoRepository from '../repositories/video.js'
import type { VideoWithRelations } from '../repositories/video.js'
import * as ffmpegService from './ffmpeg.js'
import * as storageService from './storage.js'
import { assertUsableTagIds, toTagResponse } from './tag.js'
import type {
  CreateVideoInput,
  CreateVideoResponse,
  ListVideosQuery,
  Paginated,
  StreamResponse,
  UpdateVideoInput,
  VideoResponse,
} from '../types/index.js'

const THUMBNAIL_URL_EXPIRES_IN = 60 * 60

/** DTO 変換。サムネイルは都度 Presigned URL を発行する（バケットは非公開） */
async function toVideoResponse(video: VideoWithRelations): Promise<VideoResponse> {
  let thumbnailUrl: string | null = null
  if (video.thumbnailKey) {
    const signed = await storageService.createDownloadUrl({
      key: video.thumbnailKey,
      expiresIn: THUMBNAIL_URL_EXPIRES_IN,
    })
    thumbnailUrl = signed.url
  }

  return {
    id: video.id,
    userId: video.userId,
    title: video.title,
    description: video.description,
    status: video.status,
    visibility: video.visibility,
    thumbnailUrl,
    durationSec: video.durationSec,
    fileSize: video.fileSize === null ? null : Number(video.fileSize),
    mimeType: video.mimeType,
    width: video.width,
    height: video.height,
    errorMessage: video.errorMessage,
    recordedAt: video.recordedAt?.toISOString() ?? null,
    createdAt: video.createdAt.toISOString(),
    updatedAt: video.updatedAt.toISOString(),
    tags: video.videoTags.map((videoTag) => toTagResponse(videoTag.tag)),
    commentCount: video._count.comments,
    timestampCommentCount: video._count.timestampComments,
  }
}

/** 所有者のみアクセス可能な操作で使う */
async function findOwnVideoOrThrow(userId: string, videoId: string): Promise<VideoWithRelations> {
  const video = await videoRepository.findById(videoId)
  if (!video) throw notFound('動画が見つかりません')
  if (video.userId !== userId) throw forbidden('この動画を操作する権限がありません')
  return video
}

/** 閲覧のみの操作で使う（自分の動画 または 公開動画） */
export async function findViewableVideoOrThrow(
  userId: string,
  videoId: string,
): Promise<VideoWithRelations> {
  const video = await videoRepository.findById(videoId)
  if (!video) throw notFound('動画が見つかりません')
  if (video.userId !== userId && video.visibility !== 'PUBLIC') {
    throw forbidden('この動画を閲覧する権限がありません')
  }
  return video
}

export async function listVideos(
  userId: string,
  query: ListVideosQuery,
): Promise<Paginated<VideoResponse>> {
  const { items, nextCursor } = await videoRepository.list({
    userId,
    ...(query.tag_ids ? { tagIds: query.tag_ids } : {}),
    ...(query.visibility ? { visibility: query.visibility } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { q: query.q } : {}),
    sort: query.sort,
    order: query.order,
    limit: query.limit,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  })

  return {
    items: await Promise.all(items.map(toVideoResponse)),
    nextCursor,
  }
}

export async function getVideo(userId: string, videoId: string): Promise<VideoResponse> {
  const video = await findViewableVideoOrThrow(userId, videoId)
  return toVideoResponse(video)
}

/**
 * メタデータを DB に登録し、R2 への直接アップロード用 Presigned URL を返す。
 * この時点では動画本体はまだ存在しないため status は UPLOADING。
 */
export async function createVideo(
  userId: string,
  input: CreateVideoInput,
): Promise<CreateVideoResponse> {
  if (input.fileSize > env.MAX_UPLOAD_BYTES) {
    throw payloadTooLarge(
      `ファイルサイズが上限（${Math.floor(env.MAX_UPLOAD_BYTES / 1024 / 1024)}MB）を超えています`,
    )
  }

  const tagIds = await assertUsableTagIds(userId, input.tagIds ?? [])

  const videoId = crypto.randomUUID()
  const storageKey = storageService.buildVideoKey(userId, videoId, input.fileName, input.mimeType)

  const video = await videoRepository.create({
    id: videoId,
    userId,
    title: input.title,
    description: input.description ?? null,
    storageKey,
    mimeType: input.mimeType,
    fileSize: BigInt(input.fileSize),
    status: 'UPLOADING',
    visibility: input.visibility ?? 'PRIVATE',
    recordedAt: input.recordedAt ? new Date(input.recordedAt) : null,
    ...(tagIds.length > 0
      ? { videoTags: { createMany: { data: tagIds.map((tagId) => ({ tagId })) } } }
      : {}),
  })

  const upload = await storageService.createUploadUrl({
    key: storageKey,
    contentType: input.mimeType,
  })

  return {
    video: await toVideoResponse(video),
    upload: {
      url: upload.url,
      method: 'PUT',
      headers: { 'Content-Type': input.mimeType },
      expiresIn: upload.expiresIn,
    },
  }
}

export async function updateVideo(
  userId: string,
  videoId: string,
  input: UpdateVideoInput,
): Promise<VideoResponse> {
  await findOwnVideoOrThrow(userId, videoId)

  const updated = await videoRepository.update(videoId, {
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.description === undefined ? {} : { description: input.description }),
    ...(input.visibility === undefined ? {} : { visibility: input.visibility }),
    ...(input.recordedAt === undefined
      ? {}
      : { recordedAt: input.recordedAt === null ? null : new Date(input.recordedAt) }),
  })

  return toVideoResponse(updated)
}

export async function deleteVideo(userId: string, videoId: string): Promise<void> {
  const video = await findOwnVideoOrThrow(userId, videoId)

  await storageService.deleteObjects(storageService.collectVideoObjectKeys(video))
  await videoRepository.remove(videoId)
}

export async function updateVideoTags(
  userId: string,
  videoId: string,
  tagIds: string[],
): Promise<VideoResponse> {
  await findOwnVideoOrThrow(userId, videoId)
  const usableTagIds = await assertUsableTagIds(userId, tagIds)
  const updated = await videoRepository.replaceTags(videoId, usableTagIds)
  return toVideoResponse(updated)
}

/**
 * アップロード完了通知。status を PROCESSING にしてから
 * ffmpeg 処理をバックグラウンドで走らせ、レスポンスはすぐ返す。
 * フロントエンドは GET /videos/:id をポーリングして READY を待つ。
 */
export async function completeUpload(userId: string, videoId: string): Promise<VideoResponse> {
  const video = await findOwnVideoOrThrow(userId, videoId)

  if (video.status === 'PROCESSING') {
    return toVideoResponse(video)
  }

  const updated = await videoRepository.update(videoId, {
    status: 'PROCESSING',
    errorMessage: null,
  })

  void processVideo(videoId).catch((error: unknown) => {
    console.error(`[video] 予期しない処理エラー videoId=${videoId}`, error)
  })

  return toVideoResponse(updated)
}

/**
 * R2 から動画を取得し、再生用動画への変換・メタデータ抽出・サムネイル生成を行う。
 * 失敗した場合は status を ERROR にして理由を残す（complete の再実行でリトライ可能）。
 */
export async function processVideo(videoId: string): Promise<void> {
  const video = await videoRepository.findById(videoId)
  if (!video) return

  const workDir = await mkdtemp(join(tmpdir(), `sparlog-${videoId}-`))
  const sourcePath = join(workDir, 'source')
  const playbackPath = join(workDir, 'playback.mp4')
  const thumbnailPath = join(workDir, 'thumb.jpg')

  try {
    await storageService.downloadToFile(video.storageKey, sourcePath)

    const sourceMetadata = await ffmpegService.probe(sourcePath)
    await ffmpegService.transcodeForPlayback({
      sourcePath,
      outputPath: playbackPath,
      source: sourceMetadata,
    })

    // 長さ・解像度・サムネイルは変換後の動画から取る（回転と HDR の色変換が反映済みのため）
    const metadata = await ffmpegService.probe(playbackPath)
    await ffmpegService.generateThumbnail({
      sourcePath: playbackPath,
      outputPath: thumbnailPath,
      durationSec: metadata.durationSec,
    })

    const playbackKey = storageService.buildPlaybackKey(video.userId, video.id)
    const thumbnailKey = storageService.buildThumbnailKey(video.userId, video.id)
    await storageService.uploadFile({
      key: playbackKey,
      filePath: playbackPath,
      contentType: 'video/mp4',
    })
    await storageService.uploadFile({
      key: thumbnailKey,
      filePath: thumbnailPath,
      contentType: 'image/jpeg',
    })

    await videoRepository.update(videoId, {
      status: 'READY',
      playbackKey,
      thumbnailKey,
      durationSec: metadata.durationSec,
      width: metadata.width,
      height: metadata.height,
      errorMessage: null,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '動画の処理に失敗しました'
    console.error(`[video] 処理に失敗しました videoId=${videoId}: ${message}`)
    await videoRepository.update(videoId, {
      status: 'ERROR',
      errorMessage: message.slice(0, 500),
    })
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

/** 再生用の署名付き URL を返す */
export async function getStreamUrl(userId: string, videoId: string): Promise<StreamResponse> {
  const video = await findViewableVideoOrThrow(userId, videoId)

  if (video.status !== 'READY') {
    throw badRequest('この動画はまだ再生できません（処理中またはエラー）')
  }

  // 再生用動画があればそちらを返す（変換前に登録された旧データは元ファイルを再生する）
  const signed = await storageService.createDownloadUrl({
    key: video.playbackKey ?? video.storageKey,
  })
  return {
    url: signed.url,
    expiresIn: signed.expiresIn,
    mimeType: video.playbackKey ? 'video/mp4' : video.mimeType,
  }
}
