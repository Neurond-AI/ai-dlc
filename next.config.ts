import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Prisma client needs to be treated as external in server components
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
