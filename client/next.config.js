/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*'
      }
    ];
  },
  webpack: (config) => {
    config.externals = [...(config.externals || []), 'bufferutil', 'utf-8-validate', 'pino-pretty', 'lokijs', 'encoding'];
    config.resolve.fallback = {
      ...config.resolve.fallback,
      bufferutil: false,
      'utf-8-validate': false,
    };
    return config;
  }
};

module.exports = nextConfig;