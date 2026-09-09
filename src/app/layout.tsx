import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'GanttFlow — Sprint Timeline',
  description: 'Dynamic Gantt chart synced with Frappe/ERPNext and Sprint Kickoff',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-900 text-slate-50 antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
