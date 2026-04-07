import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'
import createNextIntlPlugin from 'next-intl/plugin'
import withBundleAnalyzer from '@next/bundle-analyzer'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    root: __dirname,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // React Compiler moved out of experimental in Next.js 16
  // Auto-compilation enabled (no 'use memo' annotations needed)
  reactCompiler: true,
  experimental: {
    // Temporarily disable cacheComponents to allow Edge runtime for chat API
    // TODO: Re-enable once chat API is refactored to work with cacheComponents
    // cacheComponents: true,
    optimizePackageImports: [
      '@ai-sdk/react',
      '@ai-sdk/google',
      '@supabase/supabase-js',
      'lucide-react',
      'react-markdown',
    ],
  },
  // Webpack-based optimizations (when not using Turbopack)
  webpack: (config, { isServer }) => {
    // Fabric.js requires 'canvas' package server-side — mark as external
    if (isServer) {
      config.externals = [...(config.externals || []), 'canvas']
    }

    if (!isServer) {
      // Split vendor chunks to keep each under 500KB
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          maxSize: 450000, // 450KB limit per chunk (leaves room for compression overhead)
          cacheGroups: {
            defaultVendors: {
              test: /[\\/]node_modules[\\/]/,
              priority: -10,
              reuseExistingChunk: true,
            },
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
          },
        },
      }
    }
    return config
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.printify.com',
      },
      {
        protocol: 'https',
        hostname: 'images-api.printify.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      // Self-hosted Supabase: derive hostname from NEXT_PUBLIC_SUPABASE_URL
      ...(process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('supabase.co')
        ? [{ protocol: 'https' as const, hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname }]
        : []),
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: '*.fal.ai',
      },
      {
        protocol: 'https',
        hostname: '*.fal.media',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'pfy-prod-image-storage.s3.us-east-2.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'files.cdn.printful.com',
      },
    ],
  },
  async headers() {
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
      {
        key: 'Content-Security-Policy',
        // CSP: 'unsafe-inline' needed because Next.js injects inline scripts without nonces.
        // TODO: Implement nonce-based CSP with 'strict-dynamic' for stronger security.
        // Set NEXT_PUBLIC_API_BASE_URL in .env to allow your self-hosted Supabase API domain
        value: process.env.NODE_ENV === 'production'
          ? `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; img-src 'self' data: blob: https://*.supabase.co ${process.env.NEXT_PUBLIC_API_BASE_URL || ''} https://*.stripe.com https://*.fal.ai https://fal.media https://files.cdn.printful.com https://*.googleusercontent.com https://*.gravatar.com https://via.placeholder.com https://placehold.co https://images.unsplash.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co ${process.env.NEXT_PUBLIC_API_BASE_URL || ''} ${process.env.NEXT_PUBLIC_API_BASE_URL ? process.env.NEXT_PUBLIC_API_BASE_URL.replace('https://', 'wss://') : ''} https://api.stripe.com https://generativelanguage.googleapis.com https://*.fal.ai https://api.printful.com https://www.google.com wss://www.google.com; font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'`
          : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; img-src 'self' data: blob: https://*.supabase.co https://*.stripe.com https://*.fal.ai https://fal.media https://files.cdn.printful.com https://*.googleusercontent.com https://*.gravatar.com https://via.placeholder.com https://placehold.co https://images.unsplash.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://generativelanguage.googleapis.com https://*.fal.ai https://api.printful.com https://www.google.com wss://www.google.com ws://localhost:*; font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
      },
    ]
    return [
      { source: '/:path*', headers: securityHeaders },
      // Note: Cache-Control is set per-route — authenticated routes use no-store internally.
      // Public data routes (categories, branding) set their own Cache-Control headers.
    ]
  },
}

export default bundleAnalyzer(withSerwist(withNextIntl(nextConfig)))
