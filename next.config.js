/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // We don't use domains anymore because the remotePatterns below
    // allows images from any domain (with wildcard **)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
};

module.exports = nextConfig; 