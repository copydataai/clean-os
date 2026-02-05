import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { ClerkProvider } from '@clerk/nextjs'
import ConvexClientProvider from '@/components/ConvexClientProvider'

const brandSans = Geist({
  variable: '--font-brand-sans',
  subsets: ['latin'],
  display: 'swap',
})

const brandMono = Geist_Mono({
  variable: '--font-brand-mono',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Clean OS',
  description: 'Operations platform for modern cleaning teams.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${brandSans.variable} ${brandMono.variable} min-h-full font-sans`}>
        <ClerkProvider>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
