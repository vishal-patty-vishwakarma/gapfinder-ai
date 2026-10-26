/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Keep PDF extraction outside the bundler (pdf-parse loads its own deps).
    serverComponentsExternalPackages: ["pdf-parse"],
  },
};

export default nextConfig;
