/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@selorax/renderer', '@selorax/types'],
};

export default nextConfig;
