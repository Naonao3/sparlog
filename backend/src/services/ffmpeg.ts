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
    const { path } = value
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
  /** HDR（HLG / PQ）で撮影された動画か。iPhone の標準設定では HDR になる */
  isHdr: boolean
  hasAudio: boolean
}

/** HLG（arib-std-b67）と PQ（smpte2084）を HDR とみなす */
const HDR_TRANSFERS = new Set(['arib-std-b67', 'smpte2084'])

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
    isHdr: HDR_TRANSFERS.has(videoStream?.color_transfer ?? ''),
    hasAudio: data.streams.some((stream) => stream.codec_type === 'audio'),
  }
}

/** 再生用動画の短辺の上限（px）。縦動画も横動画も 1080p 相当に収める */
const PLAYBACK_MAX_SHORT_SIDE = 1080
/** 再生用動画のフレームレート上限 */
const PLAYBACK_MAX_FPS = 30

/**
 * 短辺を上限に収める（拡大はしない）。幅・高さは H.264 の都合で偶数にする。
 * 回転情報（iPhone の縦動画など）は ffmpeg が先に適用するため、iw / ih は回転後の値になる。
 */
const SCALE_FILTER =
  `scale=w='if(gt(iw,ih),-2,min(iw,${PLAYBACK_MAX_SHORT_SIDE}))'` +
  `:h='if(gt(iw,ih),min(ih,${PLAYBACK_MAX_SHORT_SIDE}),-2)'`

/** HDR を通常の色域（BT.709）に変換する。変換しないと白っぽく色あせて見える */
const HDR_TO_SDR_FILTERS = [
  'zscale=t=linear:npl=100',
  'format=gbrpf32le',
  'zscale=p=bt709',
  'tonemap=tonemap=hable:desat=0',
  'zscale=t=bt709:m=bt709:r=tv',
]

/**
 * ブラウザで止まらずに再生できる軽い動画（H.264 / AAC の MP4）を作る。
 * - 短辺 1080px・30fps・最大 6Mbps 程度に抑える（4K60 の iPhone 動画は 80Mbps を超える）
 * - faststart で moov を先頭に置き、ダウンロードしながら再生を始められるようにする
 */
export async function transcodeForPlayback(input: {
  sourcePath: string
  outputPath: string
  source: VideoMetadata
}): Promise<void> {
  const filters = [
    SCALE_FILTER,
    ...(input.source.isHdr ? HDR_TO_SDR_FILTERS : []),
    'format=yuv420p',
  ]

  await new Promise<void>((resolve, reject) => {
    const command = ffmpeg(input.sourcePath)
      .outputOptions([
        '-map', '0:v:0',
        ...(input.source.hasAudio ? ['-map', '0:a:0', '-c:a', 'aac', '-b:a', '128k', '-ac', '2'] : []),
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-maxrate', '6M',
        '-bufsize', '12M',
        '-profile:v', 'high',
        '-fpsmax', String(PLAYBACK_MAX_FPS),
        '-movflags', '+faststart',
      ])
      .videoFilters(filters)
      .on('end', () => resolve())
      .on('error', (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))))

    command.save(input.outputPath)
  })
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
