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
    config.resolve.alias = {
      ...config.resolve.alias,
      '@base-org/account': false,
      '@metamask/connect-evm': false,
    }
    return config
  },
};

export default nextConfig;
