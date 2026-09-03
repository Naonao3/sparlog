import { createWriteStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '../config/env.js'
import { internalError } from '../lib/errors.js'

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
})

const BUCKET = env.R2_BUCKET_NAME

const EXTENSION_BY_MIME: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'video/x-matroska': '.mkv',
  'video/x-msvideo': '.avi',
  'video/mpeg': '.mpeg',
}

/** R2 上の動画オブジェクトキー。ユーザーIDと動画IDで名前空間を分ける。 */
export function buildVideoKey(userId: string, videoId: string, fileName: string, mimeType: string): string {
  const ext = extname(fileName).toLowerCase() || EXTENSION_BY_MIME[mimeType] || '.mp4'
  return `videos/${userId}/${videoId}/original${ext}`
}

export function buildThumbnailKey(userId: string, videoId: string): string {
  return `thumbnails/${userId}/${videoId}/thumb.jpg`
}

/** アップロード用 Presigned URL（PUT）を発行する */
export async function createUploadUrl(input: {
  key: string
  contentType: string
  expiresIn?: number
}): Promise<{ url: string; expiresIn: number }> {
  const expiresIn = input.expiresIn ?? env.UPLOAD_URL_EXPIRES_IN
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: input.key,
    ContentType: input.contentType,
  })
  const url = await getSignedUrl(client, command, { expiresIn })
  return { url, expiresIn }
}

/** 再生・サムネイル取得用 Presigned URL（GET）を発行する */
export async function createDownloadUrl(input: {
  key: string
  expiresIn?: number
  downloadFileName?: string
}): Promise<{ url: string; expiresIn: number }> {
  const expiresIn = input.expiresIn ?? env.PLAYBACK_URL_EXPIRES_IN
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: input.key,
    ...(input.downloadFileName
      ? { ResponseContentDisposition: `attachment; filename="${input.downloadFileName}"` }
      : {}),
  })
  const url = await getSignedUrl(client, command, { expiresIn })
  return { url, expiresIn }
}

/** R2 のオブジェクトをローカルへダウンロードする（ffmpeg 処理用） */
export async function downloadToFile(key: string, destPath: string): Promise<void> {
  const result = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  const body = result.Body

  if (!(body instanceof Readable)) {
    throw internalError('R2 からのレスポンスボディを読み取れませんでした')
  }

  await pipeline(body, createWriteStream(destPath))
}

export async function uploadFile(input: {
  key: string
  filePath: string
  contentType: string
}): Promise<void> {
  const body = await readFile(input.filePath)
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: input.key,
      Body: body,
      ContentType: input.contentType,
    }),
  )
}

export async function deleteObjects(keys: string[]): Promise<void> {
  const targets = keys.filter((key) => key.length > 0)
  if (targets.length === 0) return

  // DeleteObjects は 1 リクエストにつき最大 1000 キー
  for (let i = 0; i < targets.length; i += 1000) {
    const chunk = targets.slice(i, i + 1000)
    await client.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
      }),
    )
  }
}
