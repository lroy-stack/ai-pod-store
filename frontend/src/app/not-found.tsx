import Link from 'next/link'
import { Button } from '@/components/ui/button'

// This is the root 404 page for non-localized routes
// Locale-specific 404s use [locale]/not-found.tsx
export default function RootNotFound() {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="text-center space-y-4 max-w-md">
            <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
            <h2 className="text-2xl font-bold text-foreground">Page Not Found</h2>
            <p className="text-muted-foreground">
              The page you are looking for does not exist or has been moved.
            </p>
            <Button asChild>
              <Link href="/en">Back to Store</Link>
            </Button>
          </div>
        </div>
      </body>
    </html>
  )
}
