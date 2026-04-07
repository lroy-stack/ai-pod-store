import { StorefrontLayout } from '@/components/storefront/StorefrontLayout'

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return <StorefrontLayout>{children}</StorefrontLayout>
}
