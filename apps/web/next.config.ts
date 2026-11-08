import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Type-only imports from the contracts package; transpile in case a value import sneaks in.
  transpilePackages: ['@certiq/contracts'],
};

export default config;
