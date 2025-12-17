import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com', pathname: '/v0/b/**' },
      // 他のストレージ/ドメインを使う場合はここに追加
    ],
  },
};

export default nextConfig;
