import type { Metadata } from 'next'
import { VideoDetail } from '@/components/video/VideoDetail'

export const metadata: Metadata = { title: '動画詳細' }

export default function VideoDetailPage({ params }: { params: { id: string } }) {
  return <VideoDetail videoId={params.id} />
}
