/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Pro produkční standalone build (optimalizovaný Docker image)
  output: 'standalone',
  
  // Compression
  compress: true,
  
  // Performance optimizations
  swcMinify: true, // Používá SWC místo Terser (rychlejší)
  
  // Image optimization
  images: {
    domains: ['localhost'],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  
  // Security headers
  async headers() {
    const securityHeaders = [
      {
        key: 'X-DNS-Prefetch-Control',
        value: 'on'
      },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload'
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff'
      },
      {
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN'
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin'
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
      }
    ];

    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },
  
  // Production-only optimizations
  ...(process.env.NODE_ENV === 'production' && {
    // Compiler options
    compiler: {
      removeConsole: {
        exclude: ['error', 'warn'], // Ponechat error a warn v produkci
      },
    },
    
    // React production mode
    productionBrowserSourceMaps: false, // Vypnout source maps v produkci
    
    // Optimized bundle
    generateEtags: true,
    poweredByHeader: false, // Skrýt X-Powered-By header
  }),
}

module.exports = nextConfig
