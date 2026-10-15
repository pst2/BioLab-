import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["10.11.185.156", "10.11.185.156:3000"],

  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "/api/backend/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;