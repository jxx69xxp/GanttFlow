import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // proxy buffers request bodies; new-task descriptions can carry inline images (5 MB each)
    proxyClientMaxBodySize: '50mb',
  },
};

export default nextConfig;
