/** @type {import('next').NextConfig} */
const isMobileExport = process.env.NEXT_OUTPUT === 'export';

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: isMobileExport ? 'export' : undefined,
  trailingSlash: isMobileExport,
  typedRoutes: false,
  images: {
    unoptimized: isMobileExport,
    domains: ['api.dicebear.com', 'picsum.photos', 'images.unsplash.com'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000',
  },
};

module.exports = nextConfig;
