import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    config.resolve.fallback = {
      ...config.resolve.fallback,
      accounts: false,
      porto: false,
      'porto/internal': false,
    }
    return config
  },
};

export default nextConfig;
