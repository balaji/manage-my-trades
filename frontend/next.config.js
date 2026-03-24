/** @type {import('next').NextConfig} */
const BACKEND_URL = process.env.BACKEND_URL || 'http://bigmac.local:8000';

const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['localhost', 'bigmac.local'],
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${BACKEND_URL}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
