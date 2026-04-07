'use client'

import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-4 px-4">
          <h1 className="text-4xl font-bold text-destructive">Something went wrong</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            An unexpected error occurred. Please try again.
          </p>
          <Button onClick={reset}>Try again</Button>
        </div>
      </body>
    </html>
  )
}
