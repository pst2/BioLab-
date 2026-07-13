import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.11.185.156", "10.11.185.156:3000"],

  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        }/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;