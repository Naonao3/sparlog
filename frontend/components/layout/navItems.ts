import { Settings, Tags, Upload, Video, type LucideIcon } from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** 完全一致でのみアクティブにするか（前方一致だと他項目と衝突する場合に使う） */
  exact?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/videos', label: '動画一覧', icon: Video, exact: true },
  { href: '/videos/upload', label: 'アップロード', icon: Upload },
  { href: '/tags', label: 'タグ管理', icon: Tags },
  { href: '/settings', label: '設定', icon: Settings },
]

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}
