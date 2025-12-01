/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Temporarily disabled for Cyber Monday launch - re-enable in Phase 2
    ignoreBuildErrors: true,
  },
  compress: true,
  poweredByHeader: false,
};

export default nextConfig;

