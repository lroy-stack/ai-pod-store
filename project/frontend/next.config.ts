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
        hostname: 'fal.media',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
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
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      {
        key: 'Content-Security-Policy',
        value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://images.printify.com https://images-api.printify.com https://*.supabase.co https://via.placeholder.com https://placehold.co https://*.fal.ai https://fal.media https://images.unsplash.com; connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com https://*.fal.ai https://images-api.printify.com https://api.printify.com; font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; frame-ancestors 'none'",
      },
    ]
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ]
  },
}

export default bundleAnalyzer(withSerwist(withNextIntl(nextConfig)))
