/** バックエンドの ALLOWED_VIDEO_MIME_TYPES と一致させること */
export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
  'video/x-msvideo',
  'video/mpeg',
] as const

export type AllowedVideoMimeType = (typeof ALLOWED_VIDEO_MIME_TYPES)[number]

/** ブラウザが MIME を返さない場合に拡張子から補完する */
const MIME_BY_EXTENSION: Record<string, AllowedVideoMimeType> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  mpeg: 'video/mpeg',
  mpg: 'video/mpeg',
}

export function isAllowedVideoMimeType(value: string): value is AllowedVideoMimeType {
  return (ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(value)
}

/** File から送信用の MIME タイプを決める。判別できない場合は null。 */
export function resolveVideoMimeType(file: File): AllowedVideoMimeType | null {
  if (isAllowedVideoMimeType(file.type)) return file.type

  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXTENSION[extension] ?? null
}

/**
 * プレイヤーに渡す MIME タイプを決める。
 * iPhone の .mov（video/quicktime）は Chrome の canPlayType では「再生不可」と判定されるが、
 * コンテナは MP4 とほぼ同じで実際には再生できるため、ブラウザが対応を返さない型は video/mp4 として渡す。
 */
export function resolvePlaybackMimeType(mimeType: string | null): string {
  if (!mimeType) return 'video/mp4'
  if (typeof document === 'undefined') return mimeType

  const canPlay = document.createElement('video').canPlayType(mimeType)
  return canPlay === '' ? 'video/mp4' : mimeType
}

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024

/** 拡張子を除いたファイル名（タイトルの初期値に使う） */
export function fileNameWithoutExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.')
  return index > 0 ? fileName.slice(0, index) : fileName
}
