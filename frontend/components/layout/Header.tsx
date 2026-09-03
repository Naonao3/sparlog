'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isNavItemActive, NAV_ITEMS } from '@/components/layout/navItems'
import { UserMenu } from '@/components/layout/UserMenu'
import { cn } from '@/lib/utils/cn'

export function Header({ email }: { email: string }) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/videos" className="text-lg font-bold tracking-tight lg:hidden">
          Spar<span className="text-primary">Log</span>
        </Link>

        {/* モバイル用ナビ（サイドバーの代わり） */}
        <nav className="hidden flex-1 items-center gap-1 sm:flex lg:hidden">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = isNavItemActive(item, pathname)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm',
                  active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto">
          <UserMenu email={email} />
        </div>
      </div>

      {/* 画面幅が最も狭い場合はアイコンのみの行を別途表示する */}
      <nav className="flex items-center gap-1 overflow-x-auto border-t px-4 py-2 sm:hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = isNavItemActive(item, pathname)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs',
                active ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
