import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'
import WalletProvider from '@/components/wallet/WalletProvider'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.zexus.xyz'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Zexus App — Demo',
  description:
    'Zexus governance platform demo — voting, Trust Scores, Emergency Calls, ZXP staking.',
  openGraph: {
    type: 'website',
    url: SITE_URL,
    title: 'Zexus App — Demo',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@ZexusGovernance',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/bold/style.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/fill/style.css" />
        {/* iOS PWA */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Zexus" />
        <meta name="theme-color" content="#0b0a09" />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          overflow: 'hidden',
          background: '#0b0a09',
        }}
        suppressHydrationWarning
      >
        <WalletProvider>{children}</WalletProvider>
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
