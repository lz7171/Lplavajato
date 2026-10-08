import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';
/** Na Vercel o site é sempre HTTPS. */
const onVercel = Boolean(process.env.VERCEL);

/**
 * Content-Security-Policy: só carrega recursos do próprio site. 'unsafe-inline' em scripts é exigido pelo
 * Next.js sem nonce (páginas estáticas); não há nenhum script de terceiros.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "media-src 'self'",
  `connect-src 'self'${isDev ? ' ws:' : ''}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(onVercel ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(onVercel ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [70, 80],
    deviceSizes: [360, 480, 640, 828, 1080, 1280],
    imageSizes: [96, 160, 256, 384],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/video/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }] },
    ];
  },
};

export default nextConfig;
