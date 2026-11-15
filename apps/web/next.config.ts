import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Use the legacy prefetch path while diagnosing the React use() router warning.
  partialPrefetching: false,
};

export default nextConfig;
