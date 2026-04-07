import { NextRequest, NextResponse } from 'next/server'
import { BASE_URL } from '@/lib/store-config'

/**
 * Proxy external images to bypass CORS restrictions.
 * Used by Design Studio to load blank garment images from Printful CDN
 * into Fabric.js canvas (which requires CORS-enabled images).
 *
 * GET /api/proxy-image?url=https://files.cdn.printful.com/...
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  // Only allow Printful CDN URLs
  const allowed = ['files.cdn.printful.com', 'files.cdn.printify.com']
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  if (parsedUrl.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only HTTPS URLs allowed' }, { status: 400 })
  }

  if (!allowed.some(domain => parsedUrl.hostname === domain)) {
    return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 })
  }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'POD-AI-Store/1.0' },
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Upstream ${res.status}` }, { status: 502 })
    }

    const buffer = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') || 'image/jpeg'

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
        'Access-Control-Allow-Origin': BASE_URL,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 })
  }
}
