import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Make sure Prisma schema, generated client, bundled ffmpeg, and fonts are included in the standalone build
  outputFileTracingIncludes: {
    "/": [
      "./prisma/schema.prisma",
      "./node_modules/.prisma/**/*",
      "./node_modules/@prisma/client/**/*",
      "./bin/**/*",
      "./fonts/**/*",
    ],
  },
  // Bundle the @prisma/client and .prisma into the standalone output
  serverExternalPackages: ["@prisma/client", ".prisma"],
};

export default nextConfig;
