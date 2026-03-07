import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No i18n — admin panel is English-only
  output: "standalone",
  // Disable Turbopack persistent cache to prevent zombie processes.
  // The admin panel is small (34 pages) — in-memory cache is sufficient.
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
  // basePath for Caddy reverse proxy routing (/panel → admin:3001)
  basePath: process.env.ADMIN_BASE_PATH || "",
  // Expose basePath to client bundles so fetch() and EventSource can prepend it.
  // Inlined at build time by webpack — single source of truth from ADMIN_BASE_PATH.
  env: {
    NEXT_PUBLIC_ADMIN_BASE_PATH: process.env.ADMIN_BASE_PATH || "",
  },
  async redirects() {
    // When basePath="/panel", anything outside /panel/* is a 404.
    // Redirect stray requests (e.g. "/", "/dashboard") to the basePath root
    // so users always land on the app instead of a blank 404.
    const bp = process.env.ADMIN_BASE_PATH
    if (!bp) return []
    return [
      {
        source: '/',
        destination: bp,
        basePath: false,
        permanent: false,
      },
      {
        source: '/:path((?!panel|_next|api).*)',
        destination: bp,
        basePath: false,
        permanent: false,
      },
    ]
  },
  async headers() {
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      {
        key: 'Content-Security-Policy',
        value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://files.cdn.printful.com https://*.supabase.co; connect-src 'self' https://*.supabase.co https://api.printful.com; font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; frame-ancestors 'none'",
      },
    ]
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ]
  },
};

export default nextConfig;
