import type { Metadata } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['300', '400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'GAME WIZARD // ONDE',
  description: 'Self-improvement loop dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={mono.className} style={{ background: 'var(--bg-void)', color: 'var(--text-bright)' }}>
        <div className="flex h-screen overflow-hidden" style={{ position: 'relative', zIndex: 1 }}>
          <Sidebar />
          <main className="flex-1 overflow-y-auto" style={{ padding: '24px 28px' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
