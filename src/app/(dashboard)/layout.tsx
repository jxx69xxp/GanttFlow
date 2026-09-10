import { Suspense } from 'react'
import { TopNav } from '@/components/TopNav'
import { Sidebar } from '@/components/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <Suspense fallback={<aside className="hidden w-56 border-r border-line bg-panel md:block" />}>
          <Sidebar />
        </Suspense>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
