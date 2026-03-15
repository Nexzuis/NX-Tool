import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    // Explicitly set the workspace root to this project so Next.js
    // does not get confused by the parent-directory lockfile.
    root: __dirname,
  },
};

export default nextConfig;
