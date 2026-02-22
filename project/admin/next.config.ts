import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No i18n — admin panel is English-only
  output: "standalone",
  // basePath for Caddy reverse proxy routing (/panel → admin:3001)
  basePath: process.env.ADMIN_BASE_PATH || "",
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
        value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://images.printify.com https://images-api.printify.com https://*.supabase.co; connect-src 'self' https://*.supabase.co https://api.printify.com; font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; frame-ancestors 'none'",
      },
    ]
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ]
  },
};

export default nextConfig;
