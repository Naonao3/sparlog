import { createReadStream, createWriteStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl as getCloudFrontSignedUrl } from '@aws-sdk/cloudfront-signer'
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '../config/env.js'
import { internalError } from '../lib/errors.js'

/**
 * 認証情報は SDK の既定の解決順（ECS ではタスクロール、ローカルでは AWS_PROFILE 等）を使う。
 *
 * SDK 既定のチェックサム計算を有効にしたままだと、Presigned PUT URL に
 * x-amz-checksum-* が含まれ、ブラウザからの直接アップロードが署名不一致で失敗するため必要時のみにする。
 */
const client = new S3Client({
  region: env.AWS_REGION,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

const BUCKET = env.S3_BUCKET_NAME

const EXTENSION_BY_MIME: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'video/x-matroska': '.mkv',
  'video/x-msvideo': '.avi',
  'video/mpeg': '.mpeg',
}

/** S3 上の動画オブジェクトキー。ユーザーIDと動画IDで名前空間を分ける。 */
export function buildVideoKey(userId: string, videoId: string, fileName: string, mimeType: string): string {
  const ext = extname(fileName).toLowerCase() || EXTENSION_BY_MIME[mimeType] || '.mp4'
  return `videos/${userId}/${videoId}/original${ext}`
}

export function buildThumbnailKey(userId: string, videoId: string): string {
  return `thumbnails/${userId}/${videoId}/thumb.jpg`
}

export function buildPlaybackKey(userId: string, videoId: string): string {
  return `videos/${userId}/${videoId}/playback.mp4`
}

/** 動画に紐づく S3 オブジェクトのキーをすべて返す（削除用） */
export function collectVideoObjectKeys(video: {
  storageKey: string
  playbackKey: string | null
  thumbnailKey: string | null
}): string[] {
  return [video.storageKey, video.playbackKey, video.thumbnailKey].filter(
    (key): key is string => key !== null,
  )
}

/** アップロード用 Presigned URL（S3 への PUT）を発行する */
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
  const url = await getS3SignedUrl(client, command, { expiresIn })
  return { url, expiresIn }
}

/** オブジェクトキーを URL のパスにする（区切りの / は残し、各セグメントをエンコードする） */
function toUrlPath(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/')
}

/**
 * 再生・サムネイル取得用の署名付き URL を発行する。
 * バケットは非公開のまま、CloudFront（署名付きURLのみ許可）経由で配信する。
 */
export function createDownloadUrl(input: {
  key: string
  expiresIn?: number
}): { url: string; expiresIn: number } {
  const expiresIn = input.expiresIn ?? env.PLAYBACK_URL_EXPIRES_IN
  const url = getCloudFrontSignedUrl({
    url: `https://${env.CLOUDFRONT_DOMAIN}/${toUrlPath(input.key)}`,
    keyPairId: env.CLOUDFRONT_KEY_PAIR_ID,
    privateKey: env.CLOUDFRONT_PRIVATE_KEY,
    dateLessThan: new Date(Date.now() + expiresIn * 1000).toISOString(),
  })
  return { url, expiresIn }
}

/** S3 のオブジェクトをローカルへダウンロードする（ffmpeg 処理用） */
export async function downloadToFile(key: string, destPath: string): Promise<void> {
  const result = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  const body = result.Body

  if (!(body instanceof Readable)) {
    throw internalError('S3 からのレスポンスボディを読み取れませんでした')
  }

  await pipeline(body, createWriteStream(destPath))
}

export async function uploadFile(input: {
  key: string
  filePath: string
  contentType: string
}): Promise<void> {
  // 再生用動画は数百MBになりうるため、メモリに載せずストリームで送る（ContentLength が必須）
  const { size } = await stat(input.filePath)
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: input.key,
      Body: createReadStream(input.filePath),
      ContentLength: size,
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
