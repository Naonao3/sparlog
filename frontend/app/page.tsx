import { redirect } from 'next/navigation'

/** ルートは動画一覧へ。未認証なら middleware がログイン画面へ飛ばす。 */
export default function HomePage() {
  redirect('/videos')
}
