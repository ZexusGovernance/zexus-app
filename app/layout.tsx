import type { Metadata } from 'next'
import './globals.css'
import WalletProvider from '@/components/wallet/WalletProvider'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.zexus.xyz'

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
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css"
        />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"></script>
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
      </body>
    </html>
  )
}
