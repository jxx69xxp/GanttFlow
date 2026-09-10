import { Suspense } from 'react'
import { GanttView } from '@/components/gantt/GanttView'

export default function HomePage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-soft">Loading Gantt…</div>}>
      <GanttView />
    </Suspense>
  )
}
