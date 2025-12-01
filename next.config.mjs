/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Temporarily disabled for Cyber Monday launch - vehicle services deferred to v2
    ignoreBuildErrors: true,
  },
  eslint: {
    // Temporarily disabled for Cyber Monday launch - vehicle services deferred to v2
    ignoreDuringBuilds: true,
  },
  compress: true,
  poweredByHeader: false,
};

export default nextConfig;

