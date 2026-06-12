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
  title: 'Zexus - DeFi Trust Layer on Base',
  description:
    'Track DeFi projects on Base. Community-verified Trust Scores, on-chain vote weight, Emergency Calls, ZXP staking.',
  openGraph: {
    type:        'website',
    url:         SITE_URL,
    siteName:    'Zexus',
    title:       'Zexus - DeFi Trust Layer on Base',
    description: 'Track DeFi projects on Base. Community-verified Trust Scores, on-chain vote weight, Emergency Calls, ZXP staking.',
    images: [{ url: `${SITE_URL}/og.svg`, width: 1200, height: 630, alt: 'Zexus - DeFi Trust Layer on Base' }],
  },
  twitter: {
    card:        'summary_large_image',
    site:        '@ZexusGovernance',
    title:       'Zexus - DeFi Trust Layer on Base',
    description: 'Track DeFi projects on Base. Community-verified Trust Scores, on-chain vote weight, Emergency Calls, ZXP staking.',
    images:      [`${SITE_URL}/og.svg`],
  },
  icons: {
    icon: [{ url: '/logo.svg', type: 'image/svg+xml' }],
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
        {/* Apply the saved theme before paint to avoid a flash of the wrong mode */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('zx_theme');if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}})();`,
          }}
        />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/bold/style.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/fill/style.css" />
        {/* iOS PWA */}
        <link rel="apple-touch-icon" sizes="180x180" href="/logo.svg" />
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
          background: 'var(--bg)',
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
