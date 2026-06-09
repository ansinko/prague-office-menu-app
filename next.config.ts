import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    '/api/scrape': ['node_modules/playwright/**', 'node_modules/playwright-core/**'],
  },
};

export default nextConfig;
