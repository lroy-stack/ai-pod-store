import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function ProductNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
        <h2 className="text-2xl font-bold text-foreground">Product Not Found</h2>
        <p className="text-muted-foreground">
          The product you are looking for does not exist or is no longer available.
        </p>
        <div className="flex gap-3 justify-center">
          <Button asChild>
            <Link href="/shop">Browse Products</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Back to Store</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
