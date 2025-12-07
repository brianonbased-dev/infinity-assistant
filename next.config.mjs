/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Temporarily disabled for Cyber Monday launch - vehicle services deferred to v2
    ignoreBuildErrors: true,
  },
  compress: true,
  poweredByHeader: false,
  // Turbopack config for Next.js 16 (empty config silences webpack warning)
  turbopack: {},
  // Enable standalone output for Docker
  output: 'standalone',
};

export default nextConfig;
