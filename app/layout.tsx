import type { Metadata } from 'next'

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
      <body
        style={{
          margin: 0,
          padding: 0,
          overflow: 'hidden',
          background: '#0b0a09',
        }}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  )
}
