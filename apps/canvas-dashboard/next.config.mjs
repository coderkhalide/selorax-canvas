/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: { allowedOrigins: ['*'] },
  },
  transpilePackages: ['@selorax/ui', '@selorax/types'],
};

export default nextConfig;
