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

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024

/** 拡張子を除いたファイル名（タイトルの初期値に使う） */
export function fileNameWithoutExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.')
  return index > 0 ? fileName.slice(0, index) : fileName
}
