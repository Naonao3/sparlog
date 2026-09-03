import type { Metadata } from 'next'
import { UploadForm } from '@/components/video/UploadForm'

export const metadata: Metadata = { title: '動画アップロード' }

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">動画アップロード</h1>
        <p className="text-sm text-muted-foreground">
          動画は Cloudflare R2 に直接アップロードされます。
        </p>
      </div>
      <UploadForm />
    </div>
  )
}
