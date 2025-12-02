import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      // Signed URLs or custom domains can be added here when needed
    ],
  },
};

export default nextConfig;
