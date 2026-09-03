import type { Metadata } from 'next'
import { VideoLibrary } from '@/components/video/VideoLibrary'

export const metadata: Metadata = { title: '動画一覧' }

export default function VideosPage() {
  return <VideoLibrary />
}
