import { Suspense } from 'react'
import { TopNav } from '@/components/TopNav'
import { Sidebar } from '@/components/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopNav />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Suspense fallback={<aside className="hidden w-56 border-r border-line bg-panel md:block" />}>
          <Sidebar />
        </Suspense>
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  )
}
