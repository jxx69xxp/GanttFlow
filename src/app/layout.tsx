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
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('ganttflow-theme')==='dark'?'dark':'light';document.documentElement.dataset.theme=t;document.documentElement.classList.toggle('dark',t==='dark')}catch(e){}`,
          }}
        />
      </head>
      <body className={`${inter.className} bg-app text-ink antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
