/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // ✅ Allows production builds to succeed even if there are type errors
    ignoreBuildErrors: true,
  },
  eslint: {
    // ✅ Allows production builds to succeed even if there are ESLint errors
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
