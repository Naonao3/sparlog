import Link from 'next/link'
import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="text-2xl font-bold tracking-tight">
            Spar<span className="text-primary">Log</span>
          </span>
        </Link>
        {children}
      </div>
    </div>
  )
}
