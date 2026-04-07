import { AuthBackground } from '@/components/auth/AuthBackground'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { FocusedFooter } from '@/components/FocusedFooter'

export default function FocusedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh bg-background">
      <AuthBackground />
      <div className="relative z-10 flex min-h-dvh flex-col items-center px-4 py-6 md:py-10">
        <div className="my-auto w-full">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
        <FocusedFooter />
      </div>
    </div>
  )
}
