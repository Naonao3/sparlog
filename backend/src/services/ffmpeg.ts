import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import { internalError } from '../lib/errors.js'

// ffmpeg-static / ffprobe-static は CJS かつ ESM 向けの型定義を持たないため、
// createRequire で読み込んで明示的に型を付ける（any は使わない）。
const require = createRequire(import.meta.url)

function readStringPath(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value
  if (typeof value === 'object' && value !== null && 'path' in value) {
    const path = (value as { path: unknown }).path
    if (typeof path === 'string' && path.length > 0) return path
  }
  return null
}

const ffmpegPath = readStringPath(require('ffmpeg-static'))
const ffprobePath = readStringPath(require('ffprobe-static'))

// システムに ffmpeg が入っていなくても動くよう、静的バイナリを明示的に使う
if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)
if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath)

export interface VideoMetadata {
  durationSec: number | null
  width: number | null
  height: number | null
}

function toFiniteInt(value: unknown): number | null {
  const num = typeof value === 'string' ? Number.parseFloat(value) : value
  if (typeof num !== 'number' || !Number.isFinite(num)) return null
  return Math.round(num)
}

/** 動画のメタデータ（長さ・解像度）を抽出する */
export async function probe(filePath: string): Promise<VideoMetadata> {
  const data = await new Promise<ffmpeg.FfprobeData>((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) reject(err instanceof Error ? err : new Error(String(err)))
      else resolve(metadata)
    })
  })

  const videoStream = data.streams.find((stream) => stream.codec_type === 'video')

  return {
    durationSec: toFiniteInt(data.format.duration),
    width: toFiniteInt(videoStream?.width),
    height: toFiniteInt(videoStream?.height),
  }
}

/**
 * サムネイルを1枚生成する。
 * 再生位置は動画長の 10%（不明な場合は 1 秒）とし、真っ黒な先頭フレームを避ける。
 */
export async function generateThumbnail(input: {
  sourcePath: string
  outputPath: string
  durationSec: number | null
  width?: number
}): Promise<void> {
  const seekSec =
    input.durationSec && input.durationSec > 0 ? Math.min(input.durationSec * 0.1, 10) : 1
  const width = input.width ?? 640

  await new Promise<void>((resolve, reject) => {
    ffmpeg(input.sourcePath)
      .on('end', () => resolve())
      .on('error', (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))))
      .screenshots({
        timestamps: [seekSec],
        filename: input.outputPath.split('/').pop() ?? 'thumb.jpg',
        folder: dirname(input.outputPath),
        size: `${width}x?`,
      })
  })
}

/** ffmpeg バイナリが利用可能かを起動時に確認する */
export function assertFfmpegAvailable(): void {
  if (!ffmpegPath || !ffprobePath) {
    throw internalError(
      'ffmpeg / ffprobe バイナリが見つかりません（ffmpeg-static・ffprobe-static の導入を確認してください）',
    )
  }
}
