import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'POD AI Store',
  description: 'AI-Managed Print-on-Demand Ecommerce Platform',
}

// Root layout - minimal, just passes through to [locale] layout
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
