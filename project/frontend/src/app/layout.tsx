import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Skapara Store',
  description: 'AI-Managed Print-on-Demand Ecommerce Platform',
}

// Root layout — pass-through only.
// <html> and <body> are rendered by [locale]/layout.tsx
// so the lang attribute can be set per-locale.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
